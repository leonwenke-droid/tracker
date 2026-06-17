/** Serverseitige Nachkorrektur nach KI-Parsing (Transkript + Ergebnis). */

const GERMAN_ONES: Record<string, number> = {
  ein: 1,
  eins: 1,
  eine: 1,
  einer: 1,
  zwei: 2,
  zwo: 2,
  drei: 3,
  vier: 4,
  fünf: 5,
  funf: 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  zwölf: 12,
  zwoelf: 12,
  zwolf: 12,
};

/** Phonetische Orts-Korrekturen (nur klare Nähe). */
const PLACE_CORRECTIONS: [RegExp, string][] = [
  [/\bmoermland\b/gi, "Moormerland"],
  [/\bmörmland\b/gi, "Moormerland"],
  [/\bmormerland\b/gi, "Moormerland"],
  [/\bmolmerland\b/gi, "Moormerland"],
  [/\breuther\s*fehn\b/gi, "Rhauderfehn"],
  [/\breutherfehn\b/gi, "Rhauderfehn"],
  [/\breuderfehn\b/gi, "Rhauderfehn"],
  [/\breuder\s*fehn\b/gi, "Rhauderfehn"],
  [/\bosterhauderfehn\b/gi, "Ostrhauderfehn"],
  [/\bvilsheim\b/gi, "Filsum"],
  [/\bfilzum\b/gi, "Filsum"],
];

function wordToDigit(w: string): number | null {
  const k = w.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  const n = GERMAN_ONES[k] ?? GERMAN_ONES[w.toLowerCase()];
  return n !== undefined && n <= 12 ? n : null;
}

/** Erkennt gesprochene Bereiche wie "zwei, sechs" oder "5, 6" im Transkript. */
export function detectSpokenRanges(transcript: string): Array<{ low: number; high: number }> {
  const ranges: Array<{ low: number; high: number }> = [];
  const t = transcript.toLowerCase();

  const wordPair =
    /\b(ein|eins|eine|zwei|zwo|drei|vier|fünf|funf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf|zwolf)\b\s*(?:,|;|und)\s*\b(ein|eins|eine|zwei|zwo|drei|vier|fünf|funf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf|zwolf)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = wordPair.exec(t)) !== null) {
    const low = wordToDigit(m[1]);
    const high = wordToDigit(m[2]);
    if (low !== null && high !== null && low <= 9 && high <= 9 && low < high) {
      ranges.push({ low, high });
    }
  }

  const digitPair = /\b(\d)\s*(?:,|;|und)\s*(\d)\b/g;
  while ((m = digitPair.exec(t)) !== null) {
    const low = Number(m[1]);
    const high = Number(m[2]);
    if (low < high) ranges.push({ low, high });
  }

  return ranges;
}

function fixMisreadPersonRanges(text: string, ranges: Array<{ low: number; high: number }>): string {
  let out = text;
  for (const { low, high } of ranges) {
    const wrong = `${low}${high}`;
    const right = `ca. ${low}–${high}`;
    out = out.replace(
      new RegExp(`\\bca\\.?\\s*${wrong}\\s*(Personen|Leute|Menschen|Gäste|Gaeste)\\b`, "gi"),
      `${right} $1`,
    );
    out = out.replace(
      new RegExp(`\\b${wrong}\\s*(Personen|Leute|Menschen|Gäste|Gaeste)\\b`, "gi"),
      `${right} $1`,
    );
  }
  return out;
}

export function applyPlaceCorrections(text: string): string {
  let out = text;
  for (const [re, replacement] of PLACE_CORRECTIONS) {
    out = out.replace(re, replacement);
  }
  return out;
}

export function sanitizeTextFields(
  transcript: string,
  fields: { notes: string; reminders: string },
): { notes: string; reminders: string } {
  const ranges = detectSpokenRanges(transcript);
  return {
    notes: applyPlaceCorrections(fixMisreadPersonRanges(fields.notes, ranges)),
    reminders: applyPlaceCorrections(fixMisreadPersonRanges(fields.reminders, ranges)),
  };
}
