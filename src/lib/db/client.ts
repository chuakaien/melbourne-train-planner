import { Pool } from "pg";

export function databaseUrl(): string {
  const url = process.env.MELBOURNE_TRAIN_DATABASE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Database is not configured. Set MELBOURNE_TRAIN_DATABASE_DATABASE_URL.");
  return url;
}
let activePool: Pool | undefined;
export function getPool(): Pool { activePool ??= new Pool({ connectionString: databaseUrl(), max: 5 }); return activePool; }
