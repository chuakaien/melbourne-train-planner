import { existsSync, mkdirSync, writeFileSync } from "node:fs";

async function main() { const url = "https://data.ptv.vic.gov.au/downloads/gtfs.zip"; const target = "data/gtfs.zip"; mkdirSync("data", { recursive: true }); const response = await fetch(url); if (!response.ok || !response.body) throw new Error(`GTFS download failed: ${response.status} ${response.statusText}`); writeFileSync(target, Buffer.from(await response.arrayBuffer())); console.log(`Downloaded ${target}${existsSync(target) ? "." : " (missing after download)"}`); }
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
