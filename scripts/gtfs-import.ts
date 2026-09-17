import dotenv from "dotenv";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { getPool } from "../src/lib/db/client";
import { gtfsTimeToSeconds } from "../src/lib/gtfs/time";

type Row = Record<string, string>;
async function main() {
dotenv.config({ path: ".env.local" });
const csv = (file: string): Row[] => parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, trim: true });
const value = (row: Row, name: string) => row[name] || null;
if (!existsSync("data/gtfs.zip")) throw new Error("Missing data/gtfs.zip. Run npm run gtfs:download first.");
const workspace = mkdtempSync(join(tmpdir(), "metro-gtfs-"));
execFileSync("unzip", ["-qq", "data/gtfs.zip", "2/google_transit.zip", "-d", workspace]);
execFileSync("unzip", ["-qq", join(workspace, "2/google_transit.zip"), "-d", join(workspace, "feed")]);
const feed = join(workspace, "feed");
const pool = getPool(); const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(readFileSync("migrations/0000_gtfs.sql", "utf8"));
  await client.query(readFileSync("migrations/0001_routes.sql", "utf8"));
  await client.query("TRUNCATE stop_times, transfers, calendar_dates, calendars, trips, stops, routes CASCADE");
  const stops = csv(join(feed, "stops.txt")); const routes = csv(join(feed, "routes.txt")); const trips = csv(join(feed, "trips.txt")); const times = csv(join(feed, "stop_times.txt")); const transfers = csv(join(feed, "transfers.txt")); const calendars = csv(join(feed, "calendar.txt")); const exceptions = csv(join(feed, "calendar_dates.txt"));
  // Bulk inserts run through the same session so the import is atomic.
  const run = async (table: string, columns: string[], rows: unknown[][]) => { for (let start = 0; start < rows.length; start += 500) { const batch = rows.slice(start, start + 500); const args = batch.flat(); const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${batch.map((row, i) => `(${row.map((_, j) => `$${i * columns.length + j + 1}`).join(",")})`).join(",")}`; await client.query(sql, args); } };
  await run("stops", ["id","name","latitude","longitude","parent_station"], stops.map(r => [r.stop_id,r.stop_name,Number(r.stop_lat),Number(r.stop_lon),value(r,"parent_station")]));
  await run("routes", ["id","short_name","long_name","color"], routes.map(r => [r.route_id,value(r,"route_short_name"),value(r,"route_long_name"),value(r,"route_color")]));
  await run("trips", ["id","route_id","service_id","headsign","block_id"], trips.map(r => [r.trip_id,r.route_id,r.service_id,value(r,"trip_headsign"),value(r,"block_id")]));
  await run("calendars", ["service_id","monday","tuesday","wednesday","thursday","friday","saturday","sunday","start_date","end_date"], calendars.map(r => [r.service_id,...["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(d=>Number(r[d])),r.start_date,r.end_date]));
  await run("calendar_dates", ["service_id","date","exception_type"], exceptions.map(r => [r.service_id,r.date,Number(r.exception_type)]));
  await run("stop_times", ["trip_id","stop_id","arrival","departure","sequence","platform_code"], times.map(r => [r.trip_id,r.stop_id,gtfsTimeToSeconds(r.arrival_time),gtfsTimeToSeconds(r.departure_time),Number(r.stop_sequence),value(r,"platform_code")]));
  await run("transfers", ["from_stop_id","to_stop_id","from_trip_id","to_trip_id","type","minimum_seconds"], transfers.map(r => [r.from_stop_id,r.to_stop_id,value(r,"from_trip_id"),value(r,"to_trip_id"),Number(r.transfer_type),r.min_transfer_time ? Number(r.min_transfer_time) : null]));
  await client.query("COMMIT"); console.log(`GTFS import complete\nStations: ${stops.length}\nTrips: ${trips.length}\nStop times: ${times.length}\nIn-seat transfers: ${transfers.filter(r=>r.transfer_type === "4").length}`);
} catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); await pool.end(); }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
