import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""; const { rows } = await getPool().query("select min(id) id, name from stops where parent_station is not null and name ilike $1 group by name order by name limit 400", [`%${query}%`]); return NextResponse.json(rows); }
