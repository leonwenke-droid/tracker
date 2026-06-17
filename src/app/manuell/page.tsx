"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button, Card, Input, OptionButton, Textarea } from "@/components/ui";
import type { Category, Entry } from "@/lib/types";
import { upsertEntry } from "@/lib/db";
import { calcHours, toISODate } from "@/lib/time";
import { learnCategoryRules } from "@/lib/category";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "Beerdigung", label: "Beerdigung" },
  { value: "Aufbahrung", label: "Aufbahrung" },
  { value: "Krematorium", label: "Krematorium" },
  { value: "Fahrdienst", label: "Fahrdienst" },
  { value: "Buero", label: "Büro" },
  { value: "Sonstiges", label: "Sonstiges" },
];

function formatHoursDE(h: number) {
  return h.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export default function ManualEntryPage() {
  const router = useRouter();
  const [date, setDate] = useState(toISODate(new Date()));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [categories, setCategories] = useState<Category[]>(["Beerdigung"]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hours = useMemo(() => calcHours(startTime, endTime), [startTime, endTime]);

  async function onSave() {
    const computed = hours;
    if (!date || !startTime || !endTime || computed === null) {
      setError("Bitte Datum sowie gültige Zeiten (Von/Bis) eintragen.");
      return;
    }
    if (!categories.length) {
      setError("Bitte mindestens eine Kategorie auswählen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entry: Entry = {
        id: uuidv4(),
        date,
        startTime,
        endTime,
        hours: computed,
        categories,
        name: name.trim() || "",
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      };
      await upsertEntry(entry);
      await learnCategoryRules({
        name,
        notes,
        chosenCategories: categories,
        threshold: 3,
      });
      router.push("/");
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-lg font-semibold">Eintrag erstellen</div>
        <div className="text-sm opacity-80">Bitte fülle alle Pflichtfelder aus.</div>
      </div>

      {error ? (
        <Card className="border-red-600">
          <div className="font-semibold">Hinweis</div>
          <div className="mt-1">{error}</div>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <Input label="Datum (YYYY-MM-DD)" value={date} onChange={setDate} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Von" value={startTime} onChange={setStartTime} placeholder="08:00" required />
          <Input label="Bis" value={endTime} onChange={setEndTime} placeholder="12:30" required />
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Kategorien (Mehrfachauswahl)</div>
          <div className="grid grid-cols-1 gap-2">
            {CATEGORIES.map((c) => (
              <OptionButton
                key={c.value}
                active={categories.includes(c.value)}
                onClick={() =>
                  setCategories((prev) =>
                    prev.includes(c.value) ? prev.filter((x) => x !== c.value) : [...prev, c.value],
                  )
                }
              >
                {c.label}
              </OptionButton>
            ))}
          </div>
        </div>

        <Input label="Name (optional)" value={name} onChange={setName} placeholder="z.B. Kontext" />
        <Textarea label="Notizen" value={notes} onChange={setNotes} placeholder="Optional" />

        <div className="text-sm opacity-80">
          Stunden: <span className="font-semibold">{hours === null ? "—" : formatHoursDE(hours)}</span>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={onSave} disabled={saving}>
          Speichern
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

