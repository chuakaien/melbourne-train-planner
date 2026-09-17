export type JourneyStop = { stopId: string; name: string; time: number; tripId: string; continuation?: "in-seat" | "reboard" };
export type Journey = { departure: number; arrival: number; transferCount: number; staysAboard: boolean; viaCityLoop: boolean; stops: JourneyStop[]; technicalTripIds: string[] };
