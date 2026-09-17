/** Converts valid GTFS HH:MM:SS (including 24+) to seconds since the service-day start. */
export function gtfsTimeToSeconds(value: string): number {
  const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid GTFS time: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function formatServiceTime(seconds: number): string {
  const normalized = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
