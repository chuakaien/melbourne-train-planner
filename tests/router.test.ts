import { describe, expect, it } from "vitest";
import { demoData } from "../src/lib/demo-data";
import { gtfsTimeToSeconds } from "../src/lib/gtfs/time";
import { findJourneys } from "../src/lib/routing/router";
describe("GTFS routing", () => { it("accepts after-midnight GTFS times", () => expect(gtfsTimeToSeconds("25:13:00")).toBe(90780)); it("keeps passengers aboard for an explicit type 4 continuation", () => { const [journey] = findJourneys(demoData, "southern-cross", "craigieburn", 0, new Date("2026-09-17T12:00:00+10:00")); expect(journey.transferCount).toBe(0); expect(journey.staysAboard).toBe(true); expect(journey.stops.map((stop) => stop.name)).toContain("Melbourne Central Station"); }); it("does not treat a type 5 record as a stay-on-board movement", () => { const data = { ...demoData, transfers: [{ ...demoData.transfers[0], type: 5 }] }; expect(findJourneys(data, "southern-cross", "craigieburn", 0, new Date("2026-09-17T12:00:00+10:00"))).toHaveLength(0); }); });
