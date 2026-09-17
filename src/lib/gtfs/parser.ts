import { parse } from "csv-parse/sync";
import { gtfsTimeToSeconds } from "./time";
import type { GtfsStop, GtfsTransfer, GtfsTrip, StopTime } from "./types";

type Row = Record<string, string>;
const rows = (source: string): Row[] => parse(source.replace(/^\uFEFF/, ""), { columns: true, skip_empty_lines: true, trim: true });
const emptyToUndefined = (value: string | undefined) => value || undefined;

export function parseStops(source: string): GtfsStop[] { return rows(source).map((row) => ({ id: row.stop_id, name: row.stop_name, latitude: Number(row.stop_lat), longitude: Number(row.stop_lon), parentStation: emptyToUndefined(row.parent_station) })); }
export function parseTrips(source: string): GtfsTrip[] { return rows(source).map((row) => ({ id: row.trip_id, routeId: row.route_id, serviceId: row.service_id, headsign: emptyToUndefined(row.trip_headsign), blockId: emptyToUndefined(row.block_id) })); }
export function parseStopTimes(source: string): StopTime[] { return rows(source).map((row) => ({ tripId: row.trip_id, stopId: row.stop_id, arrival: gtfsTimeToSeconds(row.arrival_time), departure: gtfsTimeToSeconds(row.departure_time), sequence: Number(row.stop_sequence), platformCode: emptyToUndefined(row.platform_code) })); }
export function parseTransfers(source: string): GtfsTransfer[] { return rows(source).map((row) => ({ fromStopId: row.from_stop_id, toStopId: row.to_stop_id, fromTripId: emptyToUndefined(row.from_trip_id), toTripId: emptyToUndefined(row.to_trip_id), type: Number(row.transfer_type), minimumSeconds: row.min_transfer_time ? Number(row.min_transfer_time) : undefined })); }
