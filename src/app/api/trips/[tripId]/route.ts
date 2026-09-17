import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Stop = { name: string; latitude: number; longitude: number; sequence: number };

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const { rows } = await getPool().query<Stop>(
    `select s.name, s.latitude, s.longitude, st.sequence
     from stop_times st join stops s on s.id = st.stop_id
     where st.trip_id = $1
     order by st.sequence`,
    [tripId],
  );
  if (!rows.length) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  return NextResponse.json({ destination: rows.at(-1)?.name, stops: rows });
}
