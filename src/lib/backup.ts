import type { Entry } from "@/lib/types";
import { calcHours, isValidISODate } from "@/lib/time";

const ALLOWED_CATEGORIES = new Set([
  "Beerdigung",
  "Aufbahrung",
  "Einsargung",
  "Krematorium",
  "Urnenbeisetzung",
  "Fahrdienst",
  "Sonstiges",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidEntry(index: number, detail: string): never {
  throw new Error(`Eintrag ${index + 1} ist ungültig: ${detail}.`);
}

export function parseEntriesBackup(value: unknown): Entry[] {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    throw new Error("Die Datei ist kein gültiges Zeiterfassungs-Backup.");
  }
  if (value.version !== undefined && value.version !== 1) {
    throw new Error("Diese Backup-Version wird nicht unterstützt.");
  }
  if (value.entries.length === 0) {
    throw new Error("Das Backup enthält keine Einträge.");
  }

  const ids = new Set<string>();

  return value.entries.map((raw, index) => {
    if (!isRecord(raw)) invalidEntry(index, "kein Objekt");

    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id) invalidEntry(index, "ID fehlt");
    if (ids.has(id)) invalidEntry(index, "ID kommt mehrfach vor");
    ids.add(id);

    const date = typeof raw.date === "string" ? raw.date : "";
    if (!isValidISODate(date)) invalidEntry(index, "Datum ist nicht gültig");

    const startTime = typeof raw.startTime === "string" ? raw.startTime : "";
    const endTime = typeof raw.endTime === "string" ? raw.endTime : "";
    const hours = calcHours(startTime, endTime);
    if (hours === null) invalidEntry(index, "Zeitraum ist nicht gültig");

    if (
      !Array.isArray(raw.categories) ||
      raw.categories.length === 0 ||
      raw.categories.some(
        (category) => typeof category !== "string" || !ALLOWED_CATEGORIES.has(category),
      )
    ) {
      invalidEntry(index, "Kategorie ist nicht gültig");
    }

    if (typeof raw.notes !== "string") invalidEntry(index, "Notiz fehlt");
    if (
      typeof raw.createdAt !== "string" ||
      !Number.isFinite(Date.parse(raw.createdAt))
    ) {
      invalidEntry(index, "Erstellungsdatum ist nicht gültig");
    }
    if (raw.name !== undefined && typeof raw.name !== "string") {
      invalidEntry(index, "Name ist nicht gültig");
    }
    if (raw.reminders !== undefined && typeof raw.reminders !== "string") {
      invalidEntry(index, "Erinnerung ist nicht gültig");
    }

    return {
      id,
      date,
      startTime,
      endTime,
      hours,
      categories: Array.from(new Set(raw.categories)) as Entry["categories"],
      name: raw.name ?? "",
      notes: raw.notes,
      reminders: raw.reminders ?? "",
      createdAt: raw.createdAt,
    };
  });
}
