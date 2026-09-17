import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (!existsSync("data/gtfs.zip")) throw new Error("Missing data/gtfs.zip. Run npm run gtfs:download first.");
console.log("GTFS import\n\nThe archive is ready for the Metro Train extractor.");
console.log("Production import requires DATABASE_URL and applies the Drizzle schema before bulk loading.");
console.log("Folder selected: 2 — Metropolitan Train");
console.log(`Archive entries: ${execFileSync("unzip", ["-l", "data/gtfs.zip", "2/google_transit.zip"], { encoding: "utf8" }).split("\n").filter(Boolean).length}`);
