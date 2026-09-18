import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Stop = { name: string; latitude: number; longitude: number; sequence: number; arrival: number; departure: number };
type ShapePoint = { latitude: number; longitude: number; sequence: number };

export async function GET(_request: Request, context: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await context.params;
  const pool = getPool();
  const { rows } = await pool.query<Stop>(
    `select s.name, s.latitude, s.longitude, st.sequence, st.arrival, st.departure
     from stop_times st join stops s on s.id = st.stop_id
     where st.trip_id = $1
     order by st.sequence`,
    [tripId],
  );
  if (!rows.length) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  const trip = await pool.query<{ shape_id: string | null }>("select shape_id from trips where id = $1", [tripId]);
  const shapeId = trip.rows[0]?.shape_id;
  const shape = shapeId
    ? await pool.query<ShapePoint>("select latitude, longitude, sequence from shapes where shape_id = $1 order by sequence", [shapeId])
    : { rows: [] };
  return NextResponse.json({ destination: rows.at(-1)?.name, stops: rows, shape: shape.rows });
}
