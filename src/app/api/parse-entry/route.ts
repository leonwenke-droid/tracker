import { NextResponse } from "next/server";
import OpenAI from "openai";
import { LOCATION_CORRECTION_PROMPT } from "@/lib/parse-entry-locations";
import { inferCategoriesFromText } from "@/lib/parse-entry-categories";
import { sanitizeTextFields } from "@/lib/parse-entry-sanitize";
import type { ParsedEntry } from "@/lib/types";
import { calcHours, isoToGermanDate, parseGermanDate, toISODate } from "@/lib/time";

export const runtime = "nodejs";

function isoToday(): string {
  return toISODate(new Date());
}

function extractDateFromTranscript(text: string): string | null {
  const patterns = [
    /\b(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})\b/gi,
    /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g,
  ];
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length === 0) continue;
    const last = matches[matches.length - 1][0];
    const parsed = parseGermanDate(last);
    if (parsed) return parsed;
  }
  return null;
}

function safeJsonParse(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(unfenced);
}

function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function normalizeTime(t: unknown): string | null {
  if (typeof t !== "string") return null;
  const s = t.trim();
  if (isValidTime(s)) return s;
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] !== undefined ? Number(m[2]) : 0;
  const normalized = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return isValidTime(normalized) ? normalized : null;
}

function normalizeCategory(v: unknown): ParsedEntry["categories"][number] | null {
  if (typeof v !== "string") return null;
  const map: Record<string, ParsedEntry["categories"][number]> = {
    Beerdigung: "Beerdigung",
    Aufbahrung: "Aufbahrung",
    Krematorium: "Krematorium",
    Fahrdienst: "Fahrdienst",
    Sonstiges: "Sonstiges",
    Büro: "Sonstiges",
    Buero: "Sonstiges",
  };
  return map[v.trim()] ?? null;
}

/** Fallback: Verstorbenenname aus Text, falls das Modell name leer lässt. */
function extractDeceasedName(text: string): string {
  const patterns = [
    /\b(?:Aufbahrung|Beerdigung|Verabschiedung)\s+(?:von|für)\s+((?:Frau|Herr)\s+[A-ZÄÖÜ][\wäöüß-]+)/i,
    /\b((?:Frau|Herr)\s+[A-ZÄÖÜ][\wäöüß-]+)\b/,
    /\bVerstorbene[nr]?\s+([A-ZÄÖÜ][\wäöüß-]+)\b/i,
    /\b(?:Herrn?|Frau)\s+([A-ZÄÖÜ][\wäöüß-]+)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const raw = m[1].trim();
      if (/^(Frau|Herr)\s/i.test(raw)) return raw;
      const prefix = /\bHerrn?\b/i.test(m[0]) ? "Herr" : "Frau";
      return `${prefix} ${raw}`;
    }
  }
  return "";
}

function extractRawEntries(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.entries)) return o.entries;
  if ("startTime" in o || "date" in o || "categories" in o) return [o];
  return [];
}

function ensureCategories(obj: Record<string, unknown>, ...textParts: string[]): void {
  const catsRaw = obj.categories;
  const categories = Array.isArray(catsRaw)
    ? catsRaw
        .map(normalizeCategory)
        .filter((x): x is ParsedEntry["categories"][number] => x !== null)
    : [];
  if (categories.length === 0) {
    const notes = typeof obj.notes === "string" ? obj.notes : "";
    const name = typeof obj.name === "string" ? obj.name : "";
    obj.categories = inferCategoriesFromText(...textParts, name, notes);
  }
}

function validateEntry(
  obj: unknown,
  transcript: string,
  today: string,
  index: number,
): ParsedEntry | null {
  if (!obj || typeof obj !== "object") {
    console.error("[parse-entry] entry validation failed: not an object", { index, obj });
    return null;
  }

  const o = obj as Record<string, unknown>;
  ensureCategories(o, transcript);

  const rawDate = typeof o.date === "string" ? o.date.trim() : "";
  const parsedFromModel = rawDate ? parseGermanDate(rawDate) : null;
  let date: string;
  if (parsedFromModel) {
    date = parsedFromModel;
  } else if (rawDate) {
    console.error("[parse-entry] invalid date from model, trying transcript", {
      index,
      date: o.date,
    });
    date = extractDateFromTranscript(transcript) ?? today;
  } else {
    const fromTranscript = extractDateFromTranscript(transcript);
    date = fromTranscript ?? today;
    if (!fromTranscript) {
      console.error("[parse-entry] missing date, falling back to today", { index, date: o.date });
    }
  }

  const startTime = normalizeTime(o.startTime);
  const endTime = normalizeTime(o.endTime);
  if (!startTime || !endTime) {
    console.error("[parse-entry] entry validation failed: invalid times", {
      index,
      startTime: o.startTime,
      endTime: o.endTime,
    });
    return null;
  }

  const hours = calcHours(startTime, endTime);
  if (hours === null) {
    console.error("[parse-entry] entry validation failed: calcHours returned null", {
      index,
      startTime,
      endTime,
    });
    return null;
  }

  const catsRaw = o.categories;
  const categories = Array.isArray(catsRaw)
    ? catsRaw
        .map(normalizeCategory)
        .filter((x): x is ParsedEntry["categories"][number] => x !== null)
    : [];
  if (categories.length === 0) {
    console.error("[parse-entry] entry validation failed: no categories", { index, catsRaw });
    return null;
  }

  const notes = typeof o.notes === "string" ? o.notes.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const reminders = typeof o.reminders === "string" ? o.reminders.trim() : "";

  const parsed: ParsedEntry = {
    date,
    startTime,
    endTime,
    hours,
    categories,
    name,
    notes,
    reminders,
  };

  if (!parsed.name) {
    const entryText = [parsed.notes, transcript].join(" ");
    const fallback = extractDeceasedName(entryText);
    if (fallback) parsed.name = fallback;
  }

  const sanitized = sanitizeTextFields(transcript, {
    notes: parsed.notes,
    reminders: parsed.reminders ?? "",
  });
  parsed.notes = sanitized.notes;
  parsed.reminders = sanitized.reminders;

  return parsed;
}

function buildSystemPrompt(today: string): string {
  const todayGerman = isoToGermanDate(today);
  return [
    "Du extrahierst strukturierte Arbeitszeit-Einträge aus gesprochener, informeller deutscher Sprache.",
    "Kontext: Mitarbeiter/in in einem Bestattungsunternehmen (Aufbahrung, Beerdigung, Fahrdienst, Krematorium, Sonstiges).",
    "",
    "Antworte NUR mit STRICT JSON (kein Markdown, kein Text, keine Erklärungen).",
    "Output-Schema:",
    "{",
    '  "entries": [',
    "    {",
    '      "date": "TT.MM.JJJJ",',
    '      "startTime": "HH:mm",',
    '      "endTime": "HH:mm",',
    '      "categories": ["Beerdigung"|"Aufbahrung"|"Krematorium"|"Fahrdienst"|"Sonstiges", ...],',
    '      "name": string,',
    '      "notes": string,',
    '      "reminders": string',
    "    }",
    "  ]",
    "}",
    "",
    "Immer ein Array — auch bei nur einem Eintrag.",
    "",
    "=== MEHRERE EINTRÄGE (SPLITTING) ===",
    "Teile NUR auf, wenn in einem durchgehenden Zeitblock zwei (oder mehr) UNTERSCHIEDLICHE,",
    "SEPARAT ABRECHENBARE Leistungen für verschiedene Personen/Familien ohne Pause dazwischen vorkommen.",
    "Jeder Eintrag bekommt sein eigenes startTime/endTime-Segment (lückenlos, ohne Überlappung),",
    'eigenes "name"-Feld und passende Kategorien.',
    'Beispiel: "15–19 Uhr Frau X aufgebahrt, dann ab 19 bis 21:15 Frau Y abgeholt" → 2 Einträge.',
    "",
    "NICHT aufteilen, wenn es dieselbe Person/derselbe Fall mit mehreren Kategorien ist",
    "(z.B. Aufbahrung + kurzer Friedhofsbesuch für denselben Fall) — dann EIN Eintrag mit mehreren Kategorien.",
    "Im Zweifel NICHT aufteilen.",
    "",
    '"reminders" nur beim LETZTEN Eintrag setzen, wenn mehrere Einträge erzeugt werden;',
    "bei allen anderen leerer String.",
    "",
    "=== DATUM ===",
    'Datum immer im deutschen Format TT.MM.JJJJ (z.B. "17.06.2026").',
    'Auch bei gesprochenen Daten: "1. Juni 2026" → "01.06.2026", "17. Juni" mit Jahr → "17.06.2026".',
    "Wenn dasselbe Datum mehrfach genannt wird: das letzte genannte Datum verwenden.",
    `Wenn kein Datum genannt: ${todayGerman}.`,
    "",
    "=== ZEITEN ===",
    "Zeiten als 24h HH:mm (z.B. 15:00, nicht nur 15).",
    "",
    "=== NAME (PFLICHT wenn genannt) ===",
    'Wenn ein Verstorbene/r genannt wird (z.B. "Frau Hinrichs", "Herr Müller"):',
    '- IMMER in "name" eintragen, z.B. "Frau Hinrichs".',
    "- Nicht nur in notes verstecken.",
    "",
    "=== NOTES vs REMINDERS (sehr wichtig) ===",
    '"notes" = NUR Tätigkeiten und Ereignisse, die ZUM GELOGGTEN ZEITBLOCK (date + startTime–endTime) gehören.',
    "Kurze sachliche Zusammenfassung der heutigen Arbeit in diesem Zeitraum.",
    "",
    '"reminders" = Alles, was KEINE heutige Arbeitszeit in diesem Block ist:',
    "- Zukünftige Aufgaben (Donnerstag, nächste Woche, morgen checken)",
    '- Reine Hinweise ohne heutige Tätigkeit ("ist angeliefert", "müssen wir noch prüfen")',
    "- Lieferungen/Termine, die nur angemerkt werden, nicht im Zeitraum erledigt wurden",
    "",
    "Beispiel: Sarg für Donnerstag angeliefert, Maße noch prüfen → reminders, NICHT notes.",
    "Beispiel: Friedhof Nord wegen Grabstelle heute besucht → notes (wenn im Zeitraum).",
    "",
    "=== KATEGORIEN ===",
    "Nur Kategorien vergeben, die im genannten Zeitraum tatsächlich vorkamen.",
    "Nicht raten. Krematorium nur bei echter Krematoriums-Tätigkeit.",
    "Mehrfachauswahl erlaubt (z.B. Aufbahrung + Fahrdienst).",
    "Mindestens 1 Kategorie — niemals leeres Array.",
    'Wenn nichts Spezifisches passt: "Sonstiges".',
    'Bei Fahrten oder "unterwegs": "Fahrdienst".',
    "",
    "=== ZAHLEN & UNSICHERHEIT ===",
    'Zwei aufeinanderfolgende Zahlen mit Komma/Pause (z.B. "fünf, sechs", "zwei, sechs", "drei, vier", "5, 6"):',
    '- IMMER als ungefähren Bereich interpretieren, z.B. "ca. 5–6" oder "ca. 2–6".',
    "- NIEMALS als zusammengesetzte Zahl (nicht 56, nicht 26, nicht 34).",
    'Beispiel: "waren so fünf, sechs Leute" → "ca. 5–6 Personen".',
    'Beispiel: "zwei, sechs Personen" → "ca. 2–6 Personen" (NICHT "26 Personen").',
    "",
    "Bei Unsicherheitsformulierungen in der Sprache:",
    '- Marker: "so ungefähr", "ungefähr", "circa", "ca.", "waren so", "hat so", "noch mal ungefähr"',
    "- In notes/reminders als Schätzung kennzeichnen mit \"ca.\" oder \"ungefähr\".",
    "- Nicht als exakte, sichere Tatsache formulieren.",
    'Beispiel: "das hat noch mal ungefähr eine halbe Stunde gedauert" → "ca. 30 Min. Friedhof Nord".',
    "",
    'startTime/endTime: nur exakt setzen wenn klare Zeiten genannt (z.B. "von 14 bis 18:30").',
    "Bei geschätzten Dauern ohne feste Uhrzeit: Zeiten leer lassen oder nur den sicheren Block nutzen;",
    "die Schätzung gehört in notes mit \"ca.\".",
    "",
    LOCATION_CORRECTION_PROMPT,
    "",
    "Wenn notes oder reminders leer: leerer String.",
  ].join("\n");
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server ist nicht konfiguriert (OPENAI_API_KEY fehlt)." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const transcript = (() => {
    if (!body || typeof body !== "object") return "";
    const t = (body as { transcript?: unknown }).transcript;
    return typeof t === "string" ? t.trim() : "";
  })();

  if (!transcript) {
    return NextResponse.json({ error: "Kein Text vorhanden." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });
  const today = isoToday();

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: buildSystemPrompt(today) },
        { role: "user", content: transcript },
      ],
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    let rawParsed: unknown;
    try {
      rawParsed = safeJsonParse(text);
    } catch (e) {
      const message = e instanceof Error ? e.message : "json-parse-failed";
      console.error("[parse-entry] JSON.parse failed", { message, raw: text });
      return NextResponse.json(
        { error: "Konnte Text nicht zuverlässig auswerten.", raw: text },
        { status: 422 },
      );
    }

    const rawEntries = extractRawEntries(rawParsed);
    if (rawEntries.length === 0) {
      console.error("[parse-entry] no entries in model response", { raw: text });
      return NextResponse.json(
        { error: "Konnte Text nicht zuverlässig auswerten.", raw: text },
        { status: 422 },
      );
    }

    const entries: ParsedEntry[] = [];
    for (let i = 0; i < rawEntries.length; i++) {
      const validated = validateEntry(rawEntries[i], transcript, today, i);
      if (validated) entries.push(validated);
    }

    if (entries.length === 0) {
      console.error("[parse-entry] all entries failed validation", {
        raw: text,
        entryCount: rawEntries.length,
      });
      return NextResponse.json(
        { error: "Konnte Text nicht zuverlässig auswerten.", raw: text },
        { status: 422 },
      );
    }

    return NextResponse.json({ entries });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    console.error("[parse-entry] unexpected error", { message });
    return NextResponse.json(
      { error: "Auswertung fehlgeschlagen.", details: message },
      { status: 500 },
    );
  }
}
