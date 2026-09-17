import type { ServiceCalendar, ServiceException } from "./types";

export function serviceRunsOn(serviceId: string, date: Date, calendars: ServiceCalendar[], exceptions: ServiceException[]): boolean {
  const key = date.toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" }).replaceAll("-", "");
  const exception = exceptions.find((item) => item.serviceId === serviceId && item.date === key);
  if (exception) return exception.type === 1;
  const calendar = calendars.find((item) => item.serviceId === serviceId);
  if (!calendar || key < calendar.startDate || key > calendar.endDate) return false;
  return calendar.activeWeekdays[date.getDay() === 0 ? 6 : date.getDay() - 1] ?? false;
}
