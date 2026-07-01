"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { Button, Card, DateInput, IconButton, Input, OptionButton, Textarea } from "@/components/ui";
import { VoiceReplaceEntry, type VoiceReplaceValues } from "@/components/voice-replace-entry";
import type { Category, Entry } from "@/lib/types";
import { deleteEntry, getEntry, upsertEntry } from "@/lib/db";
import { calcHours, formatGermanDate } from "@/lib/time";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "Beerdigung", label: "Beerdigung" },
  { value: "Aufbahrung", label: "Aufbahrung" },
  { value: "Einsargung", label: "Einsargung" },
  { value: "Krematorium", label: "Krematorium" },
  { value: "Fahrdienst", label: "Fahrdienst" },
  { value: "Sonstiges", label: "Sonstiges" },
];

function formatHoursDE(h: number) {
  return h.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    getEntry(id)
      .then((e) => {
        if (cancelled) return;
        if (!e) {
          setError("Eintrag nicht gefunden.");
          setEntry(null);
          return;
        }
        setEntry(e);
        setDate(e.date);
        setStartTime(e.startTime);
        setEndTime(e.endTime);
        setCategories(e.categories ?? []);
        setName(e.name ?? "");
        setNotes(e.notes ?? "");
        setReminders(e.reminders ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Konnte Eintrag nicht laden.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const hours = useMemo(() => calcHours(startTime, endTime), [startTime, endTime]);

  async function onSave() {
    if (!entry) return;
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
      await upsertEntry({
        ...entry,
        date,
        startTime,
        endTime,
        hours: computed,
        categories,
        name: name.trim() || "",
        notes: notes.trim(),
        reminders: reminders.trim(),
      });
      router.push("/");
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  function applyVoiceValues(values: VoiceReplaceValues) {
    setDate(values.date);
    setStartTime(values.startTime);
    setEndTime(values.endTime);
    setCategories(values.categories);
    setName(values.name);
    setNotes(values.notes);
    setReminders(values.reminders);
    setError(null);
  }

  async function onDelete() {
    if (!entry) return;
    const ok = window.confirm("Diesen Eintrag wirklich löschen?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await deleteEntry(entry.id);
      router.push("/");
      router.refresh();
    } catch {
      setError("Löschen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="font-semibold">Lade…</div>
      </Card>
    );
  }

  if (!entry) {
    return (
      <Card>
        <div className="font-semibold">Eintrag</div>
        <div className="mt-2">{error ?? "Unbekannter Fehler."}</div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">Eintrag bearbeiten</div>
          <div className="text-sm opacity-80">{formatGermanDate(entry.date)}</div>
        </div>
        <IconButton onClick={() => setVoiceOpen(true)} aria-label="Per Sprache ergänzen">
          <Mic className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </div>

      <VoiceReplaceEntry
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onApply={applyVoiceValues}
        existingValues={{
          date,
          startTime,
          endTime,
          categories,
          name,
          notes,
          reminders,
        }}
      />

      {error ? (
        <Card className="border-red-600">
          <div className="font-semibold">Hinweis</div>
          <div className="mt-1">{error}</div>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <DateInput label="Datum (TT.MM.JJJJ)" value={date} onChange={setDate} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Von" value={startTime} onChange={setStartTime} placeholder="08:00" />
          <Input label="Bis" value={endTime} onChange={setEndTime} placeholder="12:30" />
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

        <Input label="Name (Verstorbene/r)" value={name} onChange={setName} placeholder="z.B. Frau Hinrichs" />
        <Textarea label="Notiz" value={notes} onChange={setNotes} placeholder="Heutige Arbeit im Zeitblock" />
        <Textarea label="Später / Erinnerung" value={reminders} onChange={setReminders} placeholder="Optional" />

        <div className="flex items-center justify-between">
          <div className="text-sm opacity-80">
            Stunden: <span className="font-semibold">{hours === null ? "—" : formatHoursDE(hours)}</span>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Button variant="primary" onClick={onSave} disabled={saving}>
          Speichern
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={saving} className="border-red-600">
          Löschen
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Zurück
        </Button>
      </div>
    </div>
  );
}

