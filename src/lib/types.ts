export type Category =
  | "Beerdigung"
  | "Aufbahrung"
  | "Einsargung"
  | "Krematorium"
  | "Fahrdienst"
  | "Sonstiges";

export const DEFAULT_CATEGORIES: Category[] = ["Beerdigung", "Aufbahrung", "Krematorium"];

export type Entry = {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  hours: number;
  categories: Category[]; // multi-select
  name?: string;
  notes: string;
  reminders?: string; // separate future tasks, not part of today's hours
  createdAt: string; // ISO timestamp
};

export type ParsedEntry = Pick<
  Entry,
  "date" | "startTime" | "endTime" | "hours" | "categories" | "name" | "notes" | "reminders"
>;

export type ParseEntryResponse = {
  entries: ParsedEntry[];
};

