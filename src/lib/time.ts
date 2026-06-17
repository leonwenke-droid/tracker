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

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  maerz: 3,
  marz: 3,
  märz: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  dezember: 12,
  dez: 12,
};

function normalizeMonthName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function buildISO(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toISODate(d);
}

/** ISO YYYY-MM-DD → deutsches TT.MM.JJJJ */
export function isoToGermanDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** TT.MM.JJJJ, ISO oder „1. Juni 2026“ → ISO YYYY-MM-DD */
export function parseGermanDate(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return buildISO(
      Number(raw.slice(0, 4)),
      Number(raw.slice(5, 7)),
      Number(raw.slice(8, 10)),
    );
  }

  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/.exec(raw);
  if (dotted) {
    const day = Number(dotted[1]);
    const month = Number(dotted[2]);
    let year = Number(dotted[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return buildISO(year, month, day);
  }

  const named = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})/i.exec(raw);
  if (named) {
    const day = Number(named[1]);
    const month = GERMAN_MONTHS[normalizeMonthName(named[2])];
    const year = Number(named[3]);
    if (month) return buildISO(year, month, day);
  }

  return null;
}

export function isValidISODate(iso: string): boolean {
  return parseGermanDate(iso) === iso;
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

