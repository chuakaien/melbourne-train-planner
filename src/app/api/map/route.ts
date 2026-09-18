import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
import { fetchRealtimeMetroVehicles } from "@/lib/realtime/metro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbVehicle = {
  trip_id: string;
  route_id: string;
  route_name: string | null;
  route_color: string | null;
  headsign: string | null;
  from_latitude: number;
  from_longitude: number;
  to_latitude: number;
  to_longitude: number;
  departure: number;
  arrival: number;
};

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

export async function GET() {
  const clock = serviceClock();
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
       select t.id as trip_id, t.route_id, t.headsign, r.short_name as route_name, r.color as route_color,
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
       order by t.id
       limit 180`,
      [clock.date, clock.seconds],
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
          };
        }),
        asOf: new Date().toISOString(),
        positionSource: "realtime",
      },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
    );
  }

  const vehicles = vehicleRows.rows.map((vehicle) => {
    const duration = Math.max(1, vehicle.arrival - vehicle.departure);
    const progress = Math.max(0, Math.min(1, (clock.seconds - vehicle.departure) / duration));
    return {
      id: vehicle.trip_id,
      routeId: vehicle.route_id,
      routeName: vehicle.route_name ?? "Metro",
      routeColor: vehicle.route_color,
      headsign: vehicle.headsign ?? "Melbourne Metro service",
      latitude: vehicle.from_latitude + (vehicle.to_latitude - vehicle.from_latitude) * progress,
      longitude: vehicle.from_longitude + (vehicle.to_longitude - vehicle.from_longitude) * progress,
      heading: bearing(vehicle.from_latitude, vehicle.from_longitude, vehicle.to_latitude, vehicle.to_longitude),
    };
  });

  return NextResponse.json(
    { stations: stations.rows, vehicles, asOf: new Date().toISOString(), positionSource: "scheduled" },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } },
  );
}
