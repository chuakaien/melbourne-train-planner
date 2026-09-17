declare module "gtfs-realtime-bindings" {
  type Position = { latitude?: number; longitude?: number };
  type Vehicle = {
    trip?: { tripId?: string; routeId?: string };
    position?: Position;
  };
  type Feed = { entity?: Array<{ id?: string; vehicle?: Vehicle }> };

  const bindings: {
    transit_realtime: {
      FeedMessage: { decode(value: Uint8Array): Feed };
    };
  };

  export default bindings;
}
