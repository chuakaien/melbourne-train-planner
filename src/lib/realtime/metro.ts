import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const vehiclePositionsUrl =
  "https://api.opendata.transport.vic.gov.au/opendata/public-transport/gtfs/realtime/v1/metro/vehicle-positions";

export type RealtimeVehicle = {
  id: string;
  tripId?: string;
  routeId?: string;
  latitude: number;
  longitude: number;
  heading?: number;
};

/** Returns null when the official feed is unavailable so callers can use schedule data instead. */
export async function fetchRealtimeMetroVehicles(): Promise<RealtimeVehicle[] | null> {
  const apiKey = process.env.TRANSPORT_VIC_GTFSR_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(vehiclePositionsUrl, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(await response.arrayBuffer()),
    );
    return (feed.entity ?? []).flatMap((entity) => {
      const position = entity.vehicle?.position;
      if (typeof position?.latitude !== "number" || typeof position.longitude !== "number") return [];
      return [{
        id: entity.vehicle?.trip?.tripId ?? entity.id ?? `${position.latitude}:${position.longitude}`,
        tripId: entity.vehicle?.trip?.tripId,
        routeId: entity.vehicle?.trip?.routeId,
        latitude: position.latitude,
        longitude: position.longitude,
        heading: position.bearing,
      }];
    });
  } catch {
    return null;
  }
}
