import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
import { fetchRealtimeMetroVehicles } from "@/lib/realtime/metro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbVehicle = {
  trip_id: string;
  route_id: string;
  route_name: string | null;
  route_color: string | null;
  route_type: number | null;
  network: "metro" | "vline" | "tram" | "bus";
  headsign: string | null;
  shape_id: string | null;
  from_latitude: number;
  from_longitude: number;
  to_latitude: number;
  to_longitude: number;
  departure: number;
  arrival: number;
};

type ShapePoint = { shape_id: string; sequence: number; latitude: number; longitude: number };
type ShapeSegment = { path: ShapePoint[]; lengths: number[]; totalLength: number };

function serviceClock(now = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const seconds = Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
  const serviceDay = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));

  // Metro's after-midnight trips belong to the preceding service day in GTFS.
  if (seconds < 3 * 3600) serviceDay.setUTCDate(serviceDay.getUTCDate() - 1);

  return {
    date: serviceDay.toISOString().slice(0, 10).replaceAll("-", ""),
    seconds: seconds < 3 * 3600 ? seconds + 86400 : seconds,
    weekday: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][serviceDay.getUTCDay()],
  };
}

function bearing(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const degrees = (value: number) => (value * 180) / Math.PI;
  const longitude = radians(toLongitude - fromLongitude);
  const y = Math.sin(longitude) * Math.cos(radians(toLatitude));
  const x = Math.cos(radians(fromLatitude)) * Math.sin(radians(toLatitude)) - Math.sin(radians(fromLatitude)) * Math.cos(radians(toLatitude)) * Math.cos(longitude);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

function distance(first: Pick<ShapePoint, "latitude" | "longitude">, second: Pick<ShapePoint, "latitude" | "longitude">) {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos(((first.latitude + second.latitude) / 2) * (Math.PI / 180));
  return Math.hypot((second.latitude - first.latitude) * latitudeScale, (second.longitude - first.longitude) * longitudeScale);
}

function closestShapePoint(points: ShapePoint[], latitude: number, longitude: number) {
  return points.reduce((closest, point, index) =>
    distance(point, { latitude, longitude }) < distance(points[closest], { latitude, longitude }) ? index : closest, 0);
}

function segmentBetween(points: ShapePoint[], from: Pick<ShapePoint, "latitude" | "longitude">, to: Pick<ShapePoint, "latitude" | "longitude">): ShapeSegment | null {
  if (points.length < 2) return null;
  const fromIndex = closestShapePoint(points, from.latitude, from.longitude);
  const toIndex = closestShapePoint(points, to.latitude, to.longitude);
  if (toIndex === fromIndex) return null;

  // A few shared GTFS shapes are stored opposite to a trip's travel direction.
  // Reverse just this segment so projection still follows the rail corridor.
  const path = fromIndex < toIndex
    ? points.slice(fromIndex, toIndex + 1)
    : points.slice(toIndex, fromIndex + 1).reverse();
  const lengths = path.slice(1).map((point, index) => distance(path[index], point));
  const totalLength = lengths.reduce((total, length) => total + length, 0);
  if (totalLength === 0) return null;
  return { path, lengths, totalLength };
}

function projectSegment(segment: ShapeSegment, progress: number, snapToShapePoint = true) {
  let remaining = segment.totalLength * progress;
  for (let index = 0; index < segment.lengths.length; index += 1) {
    const segmentLength = segment.lengths[index];
    if (remaining > segmentLength && index < segment.lengths.length - 1) {
      remaining -= segmentLength;
      continue;
    }
    const ratio = segmentLength === 0 ? 0 : remaining / segmentLength;
    const from = segment.path[index];
    const to = segment.path[index + 1];
    const latitude = snapToShapePoint ? (ratio < 0.5 ? from.latitude : to.latitude) : from.latitude + (to.latitude - from.latitude) * ratio;
    const longitude = snapToShapePoint ? (ratio < 0.5 ? from.longitude : to.longitude) : from.longitude + (to.longitude - from.longitude) * ratio;
    return { latitude, longitude, heading: bearing(from.latitude, from.longitude, to.latitude, to.longitude) };
  }
  return null;
}

function mapNetwork(routeType: number | null, routeId: string): DbVehicle["network"] {
  if (routeType === 0) return "tram";
  if (routeType === 3) return "bus";
  return routeId.startsWith("aus:vic:vic-01-") ? "vline" : "metro";
}

function mapBounds(request: NextRequest) {
  const read = (name: string, fallback: number) => {
    const value = Number(request.nextUrl.searchParams.get(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    south: read("south", -38.15), north: read("north", -37.45),
    west: read("west", 144.45), east: read("east", 145.5),
  };
}

export async function GET(request: NextRequest) {
  const clock = serviceClock();
  const bounds = mapBounds(request);
  const pool = getPool();
  const [stations, vehicleRows, realtimeVehicles] = await Promise.all([
    pool.query(
      "select id, name, latitude, longitude from stops where id in (select distinct parent_station from stops where parent_station is not null) order by name",
    ),
    pool.query<DbVehicle>(
      `with active_services as (
         select c.service_id from calendars c
         where $1 between c.start_date and c.end_date and c.${clock.weekday} = 1
           and not exists (select 1 from calendar_dates removed where removed.service_id = c.service_id and removed.date = $1 and removed.exception_type = 2)
         union
         select added.service_id from calendar_dates added where added.date = $1 and added.exception_type = 1
       )
       select t.id as trip_id, t.route_id, t.headsign, t.shape_id, r.short_name as route_name, r.color as route_color, r.route_type,
              case when r.route_type = 0 then 'tram' when r.route_type = 3 then 'bus' when t.route_id like 'aus:vic:vic-01-%' then 'vline' else 'metro' end as network,
              previous_stop.latitude as from_latitude, previous_stop.longitude as from_longitude,
              next_stop.latitude as to_latitude, next_stop.longitude as to_longitude,
              previous_time.departure, next_time.arrival
       from trips t
       join active_services service on service.service_id = t.service_id
       left join routes r on r.id = t.route_id
       join lateral (
         select st.sequence, st.departure, s.latitude, s.longitude
         from stop_times st join stops s on s.id = st.stop_id
         where st.trip_id = t.id
           and (st.departure <= $2 or (st.sequence = 1 and st.departure <= $2 + 300))
         order by (st.departure <= $2) desc, st.sequence desc limit 1
       ) previous_time on true
       join lateral (
         select st.arrival, s.latitude, s.longitude
         from stop_times st join stops s on s.id = st.stop_id
         where st.trip_id = t.id and st.sequence > previous_time.sequence
         order by st.sequence limit 1
       ) next_time on next_time.arrival >= $2
       cross join lateral (
         select previous_time.latitude, previous_time.longitude
       ) previous_stop
       cross join lateral (
         select next_time.latitude, next_time.longitude
       ) next_stop
       where r.route_type is distinct from 3
          or (previous_stop.latitude between $3 and $4 and previous_stop.longitude between $5 and $6)
       order by t.id`,
      [clock.date, clock.seconds, bounds.south, bounds.north, bounds.west, bounds.east],
    ),
    fetchRealtimeMetroVehicles(),
  ]);

  if (realtimeVehicles?.length) {
    const tripIds = realtimeVehicles.flatMap((vehicle) => (vehicle.tripId ? [vehicle.tripId] : []));
    const details = tripIds.length
      ? await pool.query<{ id: string; route_id: string; headsign: string | null; route_name: string | null; route_color: string | null }>(
          "select t.id, t.route_id, t.headsign, r.short_name as route_name, r.color as route_color from trips t left join routes r on r.id = t.route_id where t.id = any($1::text[])",
          [tripIds],
        )
      : { rows: [] };
    const tripDetails = new Map(details.rows.map((trip) => [trip.id, trip]));
    return NextResponse.json(
      {
        stations: stations.rows,
        vehicles: realtimeVehicles.map((vehicle) => {
          const trip = vehicle.tripId ? tripDetails.get(vehicle.tripId) : undefined;
          return {
            id: vehicle.id,
            routeId: vehicle.routeId ?? trip?.route_id ?? "Metro",
            routeName: trip?.route_name ?? "Metro",
            routeColor: trip?.route_color ?? null,
            headsign: trip?.headsign ?? "Live Metro service",
            latitude: vehicle.latitude,
            longitude: vehicle.longitude,
            heading: vehicle.heading ?? 0,
            network: "metro",
          };
        }),
        asOf: new Date().toISOString(),
        positionSource: "realtime",
      },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
    );
  }

  const shapeIds = [...new Set(vehicleRows.rows.flatMap((vehicle) => vehicle.shape_id ? [vehicle.shape_id] : []))];
  const shapeRows = shapeIds.length
    ? await pool.query<ShapePoint>(
        "select shape_id, sequence, latitude, longitude from shapes where shape_id = any($1::text[]) order by shape_id, sequence",
        [shapeIds],
      )
    : { rows: [] };
  const shapes = new Map<string, ShapePoint[]>();
  for (const point of shapeRows.rows) {
    const shape = shapes.get(point.shape_id) ?? [];
    shape.push(point);
    shapes.set(point.shape_id, shape);
  }
  const vehicles = vehicleRows.rows.map((vehicle) => {
    const duration = Math.max(1, vehicle.arrival - vehicle.departure);
    const progress = Math.max(0, Math.min(1, (clock.seconds - vehicle.departure) / duration));
    const shape = vehicle.shape_id ? shapes.get(vehicle.shape_id) ?? [] : [];
    const segment = segmentBetween(shape, { latitude: vehicle.from_latitude, longitude: vehicle.from_longitude }, { latitude: vehicle.to_latitude, longitude: vehicle.to_longitude });
    const projected = segment ? projectSegment(segment, progress) : null;
    const fallback = projected ?? { latitude: vehicle.from_latitude, longitude: vehicle.from_longitude, heading: bearing(vehicle.from_latitude, vehicle.from_longitude, vehicle.to_latitude, vehicle.to_longitude) };
    return {
      id: vehicle.trip_id,
      routeId: vehicle.route_id,
      routeName: vehicle.route_name ?? "Metro",
      routeColor: vehicle.route_color,
      headsign: vehicle.headsign ?? "Melbourne Metro service",
      // A trip without GTFS geometry stays at its last scheduled stop rather
      // than being drawn across open land by a straight-line approximation.
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      heading: fallback.heading,
      network: mapNetwork(vehicle.route_type, vehicle.route_id),
    };
  });

  return NextResponse.json(
    { stations: stations.rows, vehicles, asOf: new Date().toISOString(), positionSource: "scheduled" },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
  );
}
