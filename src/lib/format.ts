import dayjs from "dayjs";

/** "2026-07-31" -> "31 Jul 2026" */
export function formatDate(iso: string): string {
  return dayjs(iso).format("D MMM YYYY");
}

/** Today's date as YYYY-MM-DD (local time — meetup dates are calendar dates). */
export function todayISO(): string {
  return dayjs().format("YYYY-MM-DD");
}
