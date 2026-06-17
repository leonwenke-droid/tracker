export function parseTimeToMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23) return null;
  if (min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function calcHours(startTime: string, endTime: string): number | null {
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  if (s === null || e === null) return null;
  // Same-day only (no overnight). If end < start, treat as invalid.
  if (e < s) return null;
  const minutes = e - s;
  const hours = minutes / 60;
  return Math.round(hours * 100) / 100;
}

export function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatGermanDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatGermanDateShort(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function relativeGermanDate(isoDate: string): string {
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const d = new Date(`${isoDate}T00:00:00`);
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((d0 - t0) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Heute";
  if (diffDays === -1) return "Gestern";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" }).format(d);
}

export function monthKey(isoDate: string): string {
  // YYYY-MM
  return isoDate.slice(0, 7);
}

