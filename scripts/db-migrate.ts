import { readFileSync } from "node:fs";
import { getPool } from "../src/lib/db/client";
const pool = getPool(); await pool.query(readFileSync("migrations/0000_gtfs.sql", "utf8")); await pool.end();
console.log("Database migration complete.");
