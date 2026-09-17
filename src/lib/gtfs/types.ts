export type GtfsStop = { id: string; name: string; latitude: number; longitude: number; parentStation?: string };
export type GtfsTrip = { id: string; routeId: string; serviceId: string; headsign?: string; blockId?: string };
export type StopTime = { tripId: string; stopId: string; arrival: number; departure: number; sequence: number; platformCode?: string };
export type GtfsTransfer = { fromStopId: string; toStopId: string; fromTripId?: string; toTripId?: string; type: number; minimumSeconds?: number };
export type ServiceCalendar = { serviceId: string; activeWeekdays: boolean[]; startDate: string; endDate: string };
export type ServiceException = { serviceId: string; date: string; type: 1 | 2 };
export type TransitData = { stops: GtfsStop[]; trips: GtfsTrip[]; stopTimes: StopTime[]; transfers: GtfsTransfer[]; calendars: ServiceCalendar[]; exceptions: ServiceException[] };
