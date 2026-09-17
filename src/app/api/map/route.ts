import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
export const runtime = "nodejs";
export async function GET() { const { rows } = await getPool().query("select min(id) id,name,avg(latitude) latitude,avg(longitude) longitude from stops where parent_station is not null group by name order by name"); return NextResponse.json({ stations: rows }); }
