"use client";

import type { Category } from "@/lib/types";
import { getMeta, setMeta } from "@/lib/db";

const RULES_KEY = "categoryRules.v1";
const STATS_KEY = "categoryStats.v1";

export type CategoryRule = {
  keyword: string; // normalized keyword
  category: Category;
  createdAt: string;
};

type StatsMap = Record<string, Record<Category, number>>;

const CATEGORIES: Category[] = [
  "Beerdigung",
  "Aufbahrung",
  "Einsargung",
  "Krematorium",
  "Fahrdienst",
  "Sonstiges",
];

const STOPWORDS = new Set(
  [
    "und",
    "oder",
    "aber",
    "dann",
    "heute",
    "gestern",
    "morgen",
    "von",
    "bis",
    "uhr",
    "im",
    "in",
    "am",
    "an",
    "der",
    "die",
    "das",
    "ein",
    "eine",
    "einen",
    "mit",
    "ohne",
    "für",
    "bei",
    "auf",
    "zu",
    "zum",
    "zur",
    "ins",
    "aus",
    "ich",
    "wir",
    "notiz",
    "stunde",
    "stunden",
    "min",
    "minute",
    "minuten",
  ].map((s) => s.toLowerCase()),
);

export function normalizeKeyword(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[ä]/g, "ae")
    .replace(/[ö]/g, "oe")
    .replace(/[ü]/g, "ue")
    .replace(/[ß]/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function extractKeywords(text: string): string[] {
  const norm = normalizeKeyword(text);
  if (!norm) return [];
  const parts = norm.split(" ");
  const out: string[] = [];
  for (const p of parts) {
    if (p.length < 4) continue;
    if (STOPWORDS.has(p)) continue;
    out.push(p);
  }
  // de-dup, stable
  return Array.from(new Set(out)).slice(0, 20);
}

export async function getRules(): Promise<Record<string, CategoryRule>> {
  const raw = await getMeta(RULES_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, CategoryRule>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function setRules(rules: Record<string, CategoryRule>) {
  await setMeta(RULES_KEY, JSON.stringify(rules));
}

async function getStats(): Promise<StatsMap> {
  const raw = await getMeta(STATS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as StatsMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function setStats(stats: StatsMap) {
  await setMeta(STATS_KEY, JSON.stringify(stats));
}

export async function applyCategoryRules(input: {
  transcript?: string;
  name?: string;
  notes?: string;
  fallbackCategories: Category[];
}): Promise<{ categories: Category[]; reason: string | null }> {
  const text = [input.transcript ?? "", input.name ?? "", input.notes ?? ""].join(" ").trim();
  const keywords = extractKeywords(text);
  if (keywords.length === 0) return { categories: input.fallbackCategories, reason: null };

  const rules = await getRules();
  for (const k of keywords) {
    const rule = rules[k];
    if (rule) {
      const next = Array.from(new Set([rule.category, ...input.fallbackCategories]));
      return { categories: next, reason: `Regel: „${k}“ → ${rule.category}` };
    }
  }
  return { categories: input.fallbackCategories, reason: null };
}

export async function learnCategoryRules(input: {
  transcript?: string;
  name?: string;
  notes?: string;
  chosenCategories: Category[];
  threshold?: number; // default 3
}) {
  const threshold = input.threshold ?? 3;
  const text = [input.transcript ?? "", input.name ?? "", input.notes ?? ""].join(" ").trim();
  const keywords = extractKeywords(text);
  if (keywords.length === 0) return;
  if (!input.chosenCategories.length) return;

  const [rules, stats] = await Promise.all([getRules(), getStats()]);
  let rulesChanged = false;
  let statsChanged = false;

  for (const k of keywords) {
    if (rules[k]) continue; // already fixed
    const bucket = stats[k] ?? ({} as Record<Category, number>);
    for (const c of CATEGORIES) bucket[c] = bucket[c] ?? 0;
    for (const chosen of input.chosenCategories) bucket[chosen] += 1;
    stats[k] = bucket;
    statsChanged = true;

    const total = CATEGORIES.reduce((s, c) => s + (bucket[c] ?? 0), 0);

    // Auto-pin only if ONE category is consistently used (no ambiguity).
    if (total >= threshold) {
      const nonZero = CATEGORIES.filter((c) => (bucket[c] ?? 0) > 0);
      if (nonZero.length === 1) {
        const only = nonZero[0];
        rules[k] = { keyword: k, category: only, createdAt: new Date().toISOString() };
        rulesChanged = true;
      }
    }
  }

  const ops: Promise<void>[] = [];
  if (statsChanged) ops.push(setStats(stats));
  if (rulesChanged) ops.push(setRules(rules));
  await Promise.all(ops);
}

