import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serviceClock(now = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  const seconds = Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
  const serviceDay = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  if (seconds < 3 * 3600) serviceDay.setUTCDate(serviceDay.getUTCDate() - 1);
  return { date: serviceDay.toISOString().slice(0, 10).replaceAll("-", ""), seconds: seconds < 3 * 3600 ? seconds + 86400 : seconds, weekday: ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][serviceDay.getUTCDay()] };
}

export async function GET(_request: Request, context: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await context.params;
  const clock = serviceClock();
  const { rows } = await getPool().query(
    `with active_services as (
       select c.service_id from calendars c where $1 between c.start_date and c.end_date and c.${clock.weekday} = 1
         and not exists (select 1 from calendar_dates removed where removed.service_id = c.service_id and removed.date = $1 and removed.exception_type = 2)
       union select added.service_id from calendar_dates added where added.date = $1 and added.exception_type = 1
     )
     select st.departure, coalesce(st.platform_code, s.platform_code) as platform_code, t.headsign, r.short_name as route_name, r.color as route_color
     from stop_times st join stops s on s.id = st.stop_id join trips t on t.id = st.trip_id
     join active_services active on active.service_id = t.service_id left join routes r on r.id = t.route_id
     where s.parent_station = $2 and st.departure >= $3
     order by st.departure limit 8`,
    [clock.date, stationId, clock.seconds],
  );
  return NextResponse.json({ departures: rows, asOf: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
}
