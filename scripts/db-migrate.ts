import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { getPool } from "../src/lib/db/client";
async function main() { dotenv.config({ path: ".env.local" }); const pool = getPool(); await pool.query(readFileSync("migrations/0000_gtfs.sql", "utf8")); await pool.query(readFileSync("migrations/0001_routes.sql", "utf8")); await pool.query(readFileSync("migrations/0002_shapes.sql", "utf8")); await pool.query(readFileSync("migrations/0003_route_types.sql", "utf8")); await pool.end(); console.log("Database migration complete."); }
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
