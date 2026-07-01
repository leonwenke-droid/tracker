import type { Category, Entry } from "@/lib/types";
import { monthKey } from "@/lib/time";

export function entriesForMonth(entries: Entry[], year: number, monthIndex0: number) {
  const key = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`;
  return entries.filter((e) => monthKey(e.date) === key);
}

export function sumHours(entries: Entry[]) {
  return entries.reduce((sum, e) => sum + (Number.isFinite(e.hours) ? e.hours : 0), 0);
}

export function countByTask(entries: Entry[]) {
  const counts: Record<Category, number> = {
    Beerdigung: 0,
    Aufbahrung: 0,
    Einsargung: 0,
    Krematorium: 0,
    Fahrdienst: 0,
    Sonstiges: 0,
  };
  for (const e of entries) {
    for (const c of e.categories ?? []) counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

export function monthLabelDE(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(d);
}

