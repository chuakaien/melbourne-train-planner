import type { TransitData } from "./gtfs/types";

type Call = readonly [string, string, string, number];
const calls: readonly Call[] = [
  ["southern-cross", "Southern Cross Station", "10", 8 * 60 + 14], ["flinders", "Flinders Street Station", "4", 8 * 60 + 20], ["parliament", "Parliament Station", "2", 8 * 60 + 24], ["central", "Melbourne Central Station", "1", 8 * 60 + 27], ["flagstaff", "Flagstaff Station", "1", 8 * 60 + 29], ["north-melbourne", "North Melbourne Station", "5", 8 * 60 + 35], ["craigieburn", "Craigieburn Station", "1", 9 * 60 + 3],
] as const;
const seconds = (minutes: number) => minutes * 60;
const makeTimes = (tripId: string, sequence: readonly Call[]) => sequence.map(([stopId, , platformCode, minutes], index) => ({ tripId, stopId, arrival: seconds(minutes), departure: seconds(minutes), sequence: index + 1, platformCode }));
const outbound = calls;
const inbound: readonly Call[] = [...calls].reverse().map(([id, name, platform], index) => [id, name, platform, 9 * 60 + 20 + index * 6]);

/** A UI-only schedule fixture. It is deliberately labelled as demo data until GTFS is imported. */
export const demoData: TransitData = {
  stops: calls.map(([id, name], index) => ({ id, name, latitude: -37.8 + index / 100, longitude: 144.95 })),
  trips: [
    { id: "illustration-a", routeId: "CGB", serviceId: "daily", headsign: "Craigieburn" },
    { id: "illustration-b", routeId: "CGB", serviceId: "daily", headsign: "Craigieburn" },
    { id: "illustration-return", routeId: "CGB", serviceId: "daily", headsign: "Southern Cross" },
  ],
  stopTimes: [...makeTimes("illustration-a", outbound.slice(0, 2)), ...makeTimes("illustration-b", [["flinders", "Flinders Street Station", "4", 8 * 60 + 20], ...outbound.slice(2)]), ...makeTimes("illustration-return", inbound)],
  transfers: [{ fromStopId: "flinders", toStopId: "flinders", fromTripId: "illustration-a", toTripId: "illustration-b", type: 4 }],
  calendars: [{ serviceId: "daily", activeWeekdays: [true, true, true, true, true, true, true], startDate: "20200101", endDate: "20301231" }], exceptions: [],
};
