import { serviceRunsOn } from "../gtfs/calendar";
import type { TransitData } from "../gtfs/types";
import type { Journey, JourneyStop } from "./types";

/** A correctness-first connection scan. Explicit type 4 joins are passenger stay-on-board movements. */
export function findJourneys(data: TransitData, fromStopId: string, toStopId: string, departureAfter: number, date: Date): Journey[] {
  const stops = new Map(data.stops.map((stop) => [stop.id, stop]));
  const active = new Set(data.trips.filter((trip) => serviceRunsOn(trip.serviceId, date, data.calendars, data.exceptions)).map((trip) => trip.id));
  const byTrip = new Map<string, typeof data.stopTimes>();
  for (const item of data.stopTimes) if (active.has(item.tripId)) byTrip.set(item.tripId, [...(byTrip.get(item.tripId) ?? []), item]);
  for (const times of byTrip.values()) times.sort((a, b) => a.sequence - b.sequence);
  const candidates: Journey[] = [];
  for (const [tripId, times] of byTrip) {
    const boardIndex = times.findIndex((time) => time.stopId === fromStopId && time.departure >= departureAfter);
    if (boardIndex < 0) continue;
    const initial = times.slice(boardIndex).map((time) => asStop(time, tripId, stops));
    addIfDestination(candidates, initial, toStopId);
    const tail = times.at(-1)!;
    for (const transfer of data.transfers.filter((item) => item.type === 4 && item.fromTripId === tripId && item.fromStopId === tail.stopId && item.toTripId)) {
      const next = byTrip.get(transfer.toTripId!);
      if (!next) continue;
      const join = next.findIndex((time) => time.stopId === transfer.toStopId);
      if (join < 0) continue;
      initial.at(-1)!.continuation = "in-seat";
      addIfDestination(candidates, [...initial, ...next.slice(join + 1).map((time) => asStop(time, transfer.toTripId!, stops))], toStopId);
    }
  }
  return candidates.sort((a, b) => a.arrival - b.arrival || a.transferCount - b.transferCount).slice(0, 3);
}
function asStop(time: TransitData["stopTimes"][number], tripId: string, stops: Map<string, TransitData["stops"][number]>): JourneyStop { return { stopId: time.stopId, name: stops.get(time.stopId)?.name ?? time.stopId, time: time.arrival, tripId, platformCode: time.platformCode }; }
function addIfDestination(target: Journey[], stops: JourneyStop[], destination: string) { const index = stops.findIndex((stop) => stop.stopId === destination); if (index < 0) return; const selected = stops.slice(0, index + 1); target.push({ departure: selected[0].time, arrival: selected.at(-1)!.time, transferCount: 0, staysAboard: selected.some((stop) => stop.continuation === "in-seat"), viaCityLoop: /Flinders Street|Parliament|Melbourne Central|Flagstaff/.test(selected.map((stop) => stop.name).join("|")), stops: selected, technicalTripIds: [...new Set(selected.map((stop) => stop.tripId))] }); }
