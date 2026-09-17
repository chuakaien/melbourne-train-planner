import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/client";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""; if (query.length < 2) return NextResponse.json([]); const { rows } = await getPool().query("select min(id) id, name from stops where name ilike $1 and parent_station is not null group by name order by name limit 12", [`%${query}%`]); return NextResponse.json(rows); }
