import type { Category } from "@/lib/types";

const ALL_CATEGORIES: Category[] = [
  "Beerdigung",
  "Aufbahrung",
  "Krematorium",
  "Fahrdienst",
  "Buero",
  "Sonstiges",
];

const KEYWORD_RULES: { pattern: RegExp; category: Category }[] = [
  { pattern: /\b(unterwegs|gefahren|fahrt|fahrten|transport|ueberfuehrt|überführt|abholen|bringe|gebracht)\b/i, category: "Fahrdienst" },
  { pattern: /\b(aufbahrung|aufgebahrt|aufba(h|h)ren)\b/i, category: "Aufbahrung" },
  { pattern: /\b(beerdigung|beisetzung|trauerfeier|friedhof|verabschiedung)\b/i, category: "Beerdigung" },
  { pattern: /\b(krematorium|einaescherung|einäscherung|kremation)\b/i, category: "Krematorium" },
  { pattern: /\b(buero|büro|verwaltung|schreibtisch)\b/i, category: "Buero" },
];

/** Server-side fallback when the model returns no categories. */
export function inferCategoriesFromText(...parts: string[]): Category[] {
  const text = parts.filter(Boolean).join(" ");
  if (!text.trim()) return ["Sonstiges"];

  const found = new Set<Category>();
  for (const { pattern, category } of KEYWORD_RULES) {
    if (pattern.test(text)) found.add(category);
  }

  if (found.size === 0) return ["Sonstiges"];
  return ALL_CATEGORIES.filter((c) => found.has(c));
}
