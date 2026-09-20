import dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parse as parseStream } from "csv-parse";
import { parse as parseSync } from "csv-parse/sync";
import { getPool } from "../src/lib/db/client";
import { gtfsTimeToSeconds } from "../src/lib/gtfs/time";

type Row = Record<string, string>;
type Feed = { stops: Row[]; routes: Row[]; trips: Row[]; transfers: Row[]; calendars: Row[]; exceptions: Row[]; folder: Folder; path: string };
type Folder = "1" | "2" | "3" | "4";
const shapePointStride = 2;

const csv = (file: string): Row[] => parseSync(readFileSync(file, "utf8").replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, trim: true });
const value = (row: Row, name: string) => row[name] || null;
const unique = (rows: Row[], key: string) => [...new Map(rows.map((row) => [row[key], row])).values()];
const uniqueBy = (rows: Row[], key: (row: Row) => string) => [...new Map(rows.map((row) => [key(row), row])).values()];

function extractFeed(workspace: string, folder: Folder): Feed {
  execFileSync("unzip", ["-qq", "data/gtfs.zip", `${folder}/google_transit.zip`, "-d", workspace]);
  const feed = join(workspace, folder);
  execFileSync("unzip", ["-qq", join(feed, "google_transit.zip"), "-d", feed]);
  return {
    stops: csv(join(feed, "stops.txt")), routes: csv(join(feed, "routes.txt")), trips: csv(join(feed, "trips.txt")),
    transfers: csv(join(feed, "transfers.txt")), calendars: csv(join(feed, "calendar.txt")), exceptions: csv(join(feed, "calendar_dates.txt")), folder, path: feed,
  };
}

async function main() {
  dotenv.config({ path: ".env.local" });
  if (!existsSync("data/gtfs.zip")) throw new Error("Missing data/gtfs.zip. Run npm run gtfs:download first.");

  const workspace = mkdtempSync(join(tmpdir(), "train-gtfs-"));
  // Regional Train (Folder 1) first, then Metro (Folder 2) so shared stations use Metro's richer metadata.
  const feeds = (["1", "2", "3", "4"] as Folder[]).map((folder) => extractFeed(workspace, folder));
  const [regional, metro] = feeds;
  const stops = unique(feeds.flatMap((feed) => feed.stops), "stop_id");
  const routes = unique(feeds.flatMap((feed) => feed.routes), "route_id");
  const trips = unique(feeds.flatMap((feed) => feed.trips), "trip_id");
  const shapeIds = new Set(trips.map((row) => value(row, "shape_id")).filter((shapeId): shapeId is string => Boolean(shapeId)));
  const transfers = feeds.flatMap((feed) => feed.transfers);
  const calendars = unique(feeds.flatMap((feed) => feed.calendars), "service_id");
  const exceptions = uniqueBy(feeds.flatMap((feed) => feed.exceptions), (row) => `${row.service_id}:${row.date}`);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(readFileSync("migrations/0000_gtfs.sql", "utf8"));
    await client.query(readFileSync("migrations/0001_routes.sql", "utf8"));
    await client.query(readFileSync("migrations/0002_shapes.sql", "utf8"));
    await client.query(readFileSync("migrations/0003_route_types.sql", "utf8"));
    await client.query("TRUNCATE shapes, stop_times, transfers, calendar_dates, calendars, trips, stops, routes CASCADE");
    const run = async (table: string, columns: string[], rows: unknown[][], batchSize = 500) => {
      for (let start = 0; start < rows.length; start += batchSize) {
        const batch = rows.slice(start, start + batchSize);
        const args = batch.flat();
        const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${batch.map((row, index) => `(${row.map((_, column) => `$${index * columns.length + column + 1}`).join(",")})`).join(",")}`;
        await client.query(sql, args);
      }
    };
    const importStopTimes = async (file: string) => {
      let count = 0;
      let batch: unknown[][] = [];
      const input = createReadStream(file).pipe(parseStream({ columns: true, skip_empty_lines: true, trim: true, bom: true }));
      for await (const row of input as AsyncIterable<Row>) {
        batch.push([row.trip_id, row.stop_id, gtfsTimeToSeconds(row.arrival_time), gtfsTimeToSeconds(row.departure_time), Number(row.stop_sequence), value(row, "platform_code")]);
        if (batch.length === 5_000) {
          await run("stop_times", ["trip_id", "stop_id", "arrival", "departure", "sequence", "platform_code"], batch, 5_000);
          count += batch.length;
          batch = [];
        }
      }
      if (batch.length) {
        await run("stop_times", ["trip_id", "stop_id", "arrival", "departure", "sequence", "platform_code"], batch, 5_000);
        count += batch.length;
      }
      return count;
    };
    const importShapes = async (file: string) => {
      let count = 0;
      let columns: Record<string, number> | null = null;
      let batch: unknown[][] = [];
      let currentShapeId: string | null = null;
      let pointIndex = 0;
      let lastPoint: unknown[] | null = null;
      let lastPointWasQueued = false;
      const queue = async (point: unknown[]) => {
        batch.push(point);
        if (batch.length === 5_000) {
          await run("shapes", ["shape_id", "sequence", "latitude", "longitude"], batch, 5_000);
          count += batch.length;
          batch = [];
        }
      };
      const input = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
      for await (const line of input) {
        const cells = line.split(",").map((cell) => cell.replace(/^\uFEFF/, "").replace(/^\"|\"$/g, ""));
        if (!columns) {
          columns = Object.fromEntries(cells.map((column, index) => [column, index]));
          continue;
        }
        const shapeId = cells[columns.shape_id];
        if (!shapeIds.has(shapeId)) continue;
        if (currentShapeId !== shapeId) {
          if (lastPoint && !lastPointWasQueued) await queue(lastPoint);
          currentShapeId = shapeId;
          pointIndex = 0;
        }
        const point = [shapeId, Number(cells[columns.shape_pt_sequence]), Number(cells[columns.shape_pt_lat]), Number(cells[columns.shape_pt_lon])];
        lastPoint = point;
        lastPointWasQueued = pointIndex % shapePointStride === 0;
        if (lastPointWasQueued) await queue(point);
        pointIndex += 1;
      }
      if (lastPoint && !lastPointWasQueued) await queue(lastPoint);
      if (batch.length) {
        await run("shapes", ["shape_id", "sequence", "latitude", "longitude"], batch, 5_000);
        count += batch.length;
      }
      return count;
    };
    await run("stops", ["id", "name", "latitude", "longitude", "parent_station"], stops.map((row) => [row.stop_id, row.stop_name, Number(row.stop_lat), Number(row.stop_lon), value(row, "parent_station")]));
    await run("routes", ["id", "short_name", "long_name", "color", "route_type"], routes.map((row) => [row.route_id, value(row, "route_short_name"), value(row, "route_long_name"), value(row, "route_color"), Number(row.route_type)]));
    await run("trips", ["id", "route_id", "service_id", "headsign", "block_id", "shape_id"], trips.map((row) => [row.trip_id, row.route_id, row.service_id, value(row, "trip_headsign"), value(row, "block_id"), value(row, "shape_id")]));
    await run("calendars", ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"], calendars.map((row) => [row.service_id, ...["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => Number(row[day])), row.start_date, row.end_date]));
    await run("calendar_dates", ["service_id", "date", "exception_type"], exceptions.map((row) => [row.service_id, row.date, Number(row.exception_type)]));
    let stopTimeCount = 0;
    for (const feed of feeds) stopTimeCount += await importStopTimes(join(feed.path, "stop_times.txt"));
    const shapeCounts = await Promise.all(feeds.map((feed) => importShapes(join(workspace, feed.folder, "shapes.txt"))));
    await run("transfers", ["from_stop_id", "to_stop_id", "from_trip_id", "to_trip_id", "type", "minimum_seconds"], transfers.map((row) => [row.from_stop_id, row.to_stop_id, value(row, "from_trip_id"), value(row, "to_trip_id"), Number(row.transfer_type), row.min_transfer_time ? Number(row.min_transfer_time) : null]));
    await client.query("COMMIT");
    console.log(`GTFS import complete\nStops: ${stops.length}\nRoutes: ${routes.length}\nTrips: ${trips.length}\nStop times: ${stopTimeCount}\nShape points: ${shapeCounts.reduce((total, count) => total + count, 0)}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
