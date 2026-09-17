import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from"); const to = request.nextUrl.searchParams.get("to");
  if (!from || !to || from === to) return NextResponse.json({ journeys: [] }, { status: 400 });
  const sql = `with candidates as (select o.trip_id,o.sequence os,d.sequence ds,o.departure,d.arrival from stop_times o join stop_times d on d.trip_id=o.trip_id and d.sequence>o.sequence where o.stop_id=$1 and d.stop_id=$2 order by d.arrival,o.departure limit 3) select c.trip_id,c.departure,c.arrival,s.name,s.stop_id,s.platform_code,s.arrival as stop_arrival,s.sequence from candidates c join stop_times s on s.trip_id=c.trip_id and s.sequence between c.os and c.ds join stops st on st.id=s.stop_id order by c.trip_id,s.sequence`;
  const { rows } = await getPool().query(sql, [from, to]); const grouped = new Map<string, typeof rows>(); for (const row of rows) grouped.set(row.trip_id, [...(grouped.get(row.trip_id) ?? []), row]);
  return NextResponse.json({ journeys: [...grouped.values()].map(stops => ({ tripId: stops[0].trip_id, departure: Number(stops[0].departure), arrival: Number(stops.at(-1)!.arrival), transferCount: 0, stops: stops.map(s => ({ name:s.name, stopId:s.stop_id, time:Number(s.stop_arrival), platformCode:s.platform_code })) })) });
}
