"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, RotateCcw, Check, Save, PencilLine, ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button, Card, IconButton, Input, ListCard, ListRow, OptionButton, Textarea, DateInput } from "@/components/ui";
import type { Category, Entry, ParseEntryResponse } from "@/lib/types";
import { upsertEntry } from "@/lib/db";
import { calcHours } from "@/lib/time";
import { useVoiceCapture } from "@/lib/voice-capture";
import { applyCategoryRules, learnCategoryRules } from "@/lib/category";

type PostCaptureStep = "transcript" | "review" | "parsed" | "saved";

type DraftEntry = {
  date: string;
  startTime: string;
  endTime: string;
  categories: Category[];
  name: string;
  notes: string;
  reminders: string;
  categoryReason: string | null;
};

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

function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime}–${endTime}`;
}

export default function SprechenPage() {
  const router = useRouter();
  const voice = useVoiceCapture();
  const savedSummaryRef = useRef({ count: 0, totalHours: 0 });

  const [postStep, setPostStep] = useState<PostCaptureStep | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedSummary, setSavedSummary] = useState({ count: 0, totalHours: 0 });

  const activeDraft = drafts[activeIndex] ?? null;
  const computedHours = useMemo(
    () => (activeDraft ? calcHours(activeDraft.startTime, activeDraft.endTime) : null),
    [activeDraft],
  );

  const error = pageError ?? voice.error;

  useEffect(() => {
    if (voice.step === "done" && postStep === null) {
      setPostStep("transcript");
    }
  }, [voice.step, postStep]);

  function resetAll() {
    voice.reset();
    setPageError(null);
    setParsing(false);
    setSaving(false);
    setDrafts([]);
    setActiveIndex(0);
    savedSummaryRef.current = { count: 0, totalHours: 0 };
    setSavedSummary({ count: 0, totalHours: 0 });
    setPostStep(null);
  }

  function updateActiveDraft(patch: Partial<DraftEntry>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === activeIndex ? { ...d, ...patch } : d)),
    );
  }

  async function buildDraftsFromResponse(entries: ParseEntryResponse["entries"]): Promise<DraftEntry[]> {
    return Promise.all(
      entries.map(async (parsed) => {
        const applied = await applyCategoryRules({
          transcript: voice.transcript,
          name: parsed.name ?? "",
          notes: parsed.notes ?? "",
          fallbackCategories: parsed.categories ?? ["Sonstiges"],
        });
        return {
          date: parsed.date,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          categories: applied.categories,
          name: parsed.name ?? "",
          notes: parsed.notes ?? "",
          reminders: parsed.reminders ?? "",
          categoryReason: applied.reason,
        };
      }),
    );
  }

  async function parseTranscript() {
    setPageError(null);
    setParsing(true);
    try {
      const res = await fetch("/api/parse-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: voice.transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPageError(data?.error || "Auswertung fehlgeschlagen.");
        setParsing(false);
        return;
      }
      const { entries } = data as ParseEntryResponse;
      if (!entries?.length) {
        setPageError("Konnte Text nicht zuverlässig auswerten.");
        setParsing(false);
        return;
      }
      const nextDrafts = await buildDraftsFromResponse(entries);
      setDrafts(nextDrafts);
      setActiveIndex(0);
      setPostStep(nextDrafts.length > 1 ? "review" : "parsed");
    } catch {
      setPageError("Keine Verbindung zur Auswertung. Bitte versuche es erneut.");
    } finally {
      setParsing(false);
    }
  }

  function openDraft(index: number) {
    setActiveIndex(index);
    setPostStep("parsed");
  }

  function validateDraft(draft: DraftEntry): string | null {
    const computed = calcHours(draft.startTime, draft.endTime);
    if (!draft.date || !draft.startTime || !draft.endTime || computed === null) {
      return "Bitte prüfe Datum und Zeiten (Von/Bis).";
    }
    if (!draft.categories.length) {
      return "Bitte mindestens eine Kategorie auswählen.";
    }
    return null;
  }

  async function persistDraft(draft: DraftEntry) {
    const computed = calcHours(draft.startTime, draft.endTime);
    if (computed === null) throw new Error("invalid hours");
    const entry: Entry = {
      id: uuidv4(),
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      hours: computed,
      categories: draft.categories,
      name: draft.name.trim() || "",
      notes: draft.notes.trim(),
      reminders: draft.reminders.trim(),
      createdAt: new Date().toISOString(),
    };
    await upsertEntry(entry);
    await learnCategoryRules({
      transcript: voice.transcript,
      name: draft.name,
      notes: draft.notes,
      chosenCategories: draft.categories,
      threshold: 3,
    });
    return computed;
  }

  function recordSaved(hours: number) {
    savedSummaryRef.current = {
      count: savedSummaryRef.current.count + 1,
      totalHours: Math.round((savedSummaryRef.current.totalHours + hours) * 100) / 100,
    };
    setSavedSummary({ ...savedSummaryRef.current });
  }

  async function saveCurrentEntry() {
    if (!activeDraft) return;
    setPageError(null);
    const validationError = validateDraft(activeDraft);
    if (validationError) {
      setPageError(validationError);
      return;
    }
    setSaving(true);
    try {
      const hours = await persistDraft(activeDraft);
      recordSaved(hours);
      const remaining = drafts.filter((_, i) => i !== activeIndex);
      setDrafts(remaining);
      if (remaining.length === 0) {
        setPostStep("saved");
        router.refresh();
      } else {
        setActiveIndex(0);
        setPostStep("review");
        router.refresh();
      }
    } catch {
      setPageError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAllEntries() {
    setPageError(null);
    for (const draft of drafts) {
      const validationError = validateDraft(draft);
      if (validationError) {
        setPageError(validationError);
        return;
      }
    }
    setSaving(true);
    try {
      for (const draft of drafts) {
        const hours = await persistDraft(draft);
        recordSaved(hours);
      }
      setDrafts([]);
      setPostStep("saved");
      router.refresh();
    } catch {
      setPageError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  function toggleListening() {
    if (voice.step === "ready") voice.start();
    else if (voice.step === "listening") voice.stop();
  }

  const capturing = postStep === null;
  const micButtonClass =
    voice.step === "listening"
      ? "bg-[var(--accent)] text-white shadow-sm"
      : "bg-[var(--card)] text-[var(--foreground)] border border-[var(--divider)]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <IconButton onClick={() => router.back()} aria-label="Zurück">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <div>
          <div className="text-lg font-semibold">Spracheingabe</div>
          <div className="text-sm text-[var(--muted)]">Sprich in deinem Tempo – Pausen sind in Ordnung.</div>
        </div>
      </div>

      {error ? (
        <Card className="border-red-600">
          <div className="font-semibold">Hinweis</div>
          <div className="mt-1">{error}</div>
          <div className="mt-3">
            <Link href="/manuell" className="underline">
              Manuell eintragen
            </Link>
          </div>
        </Card>
      ) : null}

      {capturing && (voice.step === "ready" || voice.step === "listening") ? (
        <Card className="flex flex-col items-center gap-4 py-8">
          <div className="text-base font-semibold">
            {voice.step === "listening" ? "Aufnahme läuft…" : "Bereit zum Sprechen"}
          </div>
          <button
            type="button"
            onClick={toggleListening}
            className={[
              "h-24 w-24 flex items-center justify-center rounded-full",
              micButtonClass,
              voice.step === "listening" ? "animate-pulse" : "",
            ].join(" ")}
            aria-label={voice.step === "listening" ? "Aufnahme stoppen" : "Aufnahme starten"}
            aria-pressed={voice.step === "listening"}
          >
            <Mic className="h-10 w-10" aria-hidden="true" />
          </button>
          <div className="text-sm text-[var(--muted)] text-center">
            {voice.step === "listening"
              ? "Nochmal tippen, wenn du fertig bist."
              : "Tippen zum Starten. Nochmal tippen zum Beenden."}
          </div>
          {voice.step === "listening" && voice.liveText ? (
            <div className="w-full rounded-[var(--radius)] bg-[var(--background)] p-3 text-sm">{voice.liveText}</div>
          ) : null}
          {!voice.support.supported ? (
            <div className="text-sm text-[var(--muted)] text-center">
              Dein Browser unterstützt keine Spracherkennung.
            </div>
          ) : null}
        </Card>
      ) : null}

      {capturing && voice.step === "processing" ? (
        <Card className="flex flex-col gap-3">
          <div className="font-semibold">Text wird verarbeitet…</div>
          <div className="text-sm opacity-80">
            Bitte kurz warten – der letzte Teil deiner Sprache wird noch erfasst.
          </div>
          {voice.liveText ? (
            <div className="rounded-[var(--radius)] bg-[var(--background)] p-3">{voice.liveText}</div>
          ) : (
            <div className="rounded-[var(--radius)] bg-[var(--background)] p-3 text-[var(--muted)]">…</div>
          )}
        </Card>
      ) : null}

      {postStep === "transcript" ? (
        <Card className="flex flex-col gap-3">
          <div className="font-semibold">Stimmt das so?</div>
          <div className="rounded-[var(--radius)] bg-[var(--background)] p-3">{voice.transcript}</div>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="primary" onClick={parseTranscript} disabled={parsing}>
              <Check className="h-5 w-5" aria-hidden="true" />
              Ja, weiter
            </Button>
            <Button variant="outline" onClick={resetAll} disabled={parsing}>
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              Nochmal sprechen
            </Button>
          </div>
        </Card>
      ) : null}

      {postStep === "review" ? (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2">
            <div className="font-semibold">{drafts.length} Einträge erkannt</div>
            <div className="text-sm text-[var(--muted)]">
              Tippe einen Eintrag an, um Details zu prüfen oder zu ändern.
            </div>
          </Card>
          <ListCard>
            {drafts.map((draft, index) => {
              const hours = calcHours(draft.startTime, draft.endTime);
              return (
                <ListRow
                  key={`${draft.startTime}-${draft.endTime}-${index}`}
                  onClick={() => openDraft(index)}
                  title={draft.name.trim() || "Ohne Namen"}
                  subtitle={`${draft.categories.join(", ")} · ${formatTimeRange(draft.startTime, draft.endTime)}`}
                  trailing={hours === null ? "—" : formatHoursDE(hours)}
                />
              );
            })}
          </ListCard>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="primary" onClick={saveAllEntries} disabled={saving}>
              <Save className="h-5 w-5" aria-hidden="true" />
              Speichere alle {drafts.length} Einträge
            </Button>
            <Button variant="outline" onClick={() => setPostStep("transcript")} disabled={saving}>
              <PencilLine className="h-5 w-5" aria-hidden="true" />
              Zurück zum Text
            </Button>
          </div>
        </div>
      ) : null}

      {postStep === "parsed" && activeDraft ? (
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-3">
            <div className="font-semibold">
              {drafts.length > 1
                ? `Eintrag ${activeIndex + 1} von ${drafts.length}`
                : "Bitte kurz prüfen"}
            </div>
            {activeDraft.categoryReason ? (
              <div className="text-sm opacity-80">{activeDraft.categoryReason}</div>
            ) : null}
            <div className="grid grid-cols-1 gap-3">
              <DateInput
                label="Datum (TT.MM.JJJJ)"
                value={activeDraft.date}
                onChange={(v) => updateActiveDraft({ date: v })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Von"
                  value={activeDraft.startTime}
                  onChange={(v) => updateActiveDraft({ startTime: v })}
                  placeholder="08:00"
                />
                <Input
                  label="Bis"
                  value={activeDraft.endTime}
                  onChange={(v) => updateActiveDraft({ endTime: v })}
                  placeholder="12:30"
                />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Kategorien (Mehrfachauswahl)</div>
                <div className="grid grid-cols-1 gap-2">
                  {CATEGORIES.map((c) => (
                    <OptionButton
                      key={c.value}
                      active={activeDraft.categories.includes(c.value)}
                      onClick={() =>
                        updateActiveDraft({
                          categories: activeDraft.categories.includes(c.value)
                            ? activeDraft.categories.filter((x) => x !== c.value)
                            : [...activeDraft.categories, c.value],
                        })
                      }
                    >
                      {c.label}
                    </OptionButton>
                  ))}
                </div>
              </div>

              <Input
                label="Name (Verstorbene/r)"
                value={activeDraft.name}
                onChange={(v) => updateActiveDraft({ name: v })}
                placeholder="z.B. Frau Hinrichs"
              />
              <Textarea
                label="Notiz (nur heutige Arbeit im Zeitblock)"
                value={activeDraft.notes}
                onChange={(v) => updateActiveDraft({ notes: v })}
                placeholder="Was wurde in diesem Zeitraum gemacht?"
              />
              <Textarea
                label="Später / Erinnerung (optional)"
                value={activeDraft.reminders}
                onChange={(v) => updateActiveDraft({ reminders: v })}
                placeholder="Zukünftige Aufgaben, die nicht zur heutigen Arbeitszeit gehören"
              />

              <div className="text-sm opacity-80">
                Stunden:{" "}
                <span className="font-semibold">
                  {computedHours === null ? "—" : formatHoursDE(computedHours)}
                </span>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-2">
            <Button variant="primary" onClick={saveCurrentEntry} disabled={saving}>
              <Save className="h-5 w-5" aria-hidden="true" />
              {drafts.length > 1 ? "Diesen Eintrag speichern" : "Speichern"}
            </Button>
            {drafts.length > 1 ? (
              <Button variant="outline" onClick={() => setPostStep("review")} disabled={saving}>
                <ChevronRight className="h-5 w-5 rotate-180" aria-hidden="true" />
                Zurück zur Übersicht
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setPostStep("transcript")} disabled={saving}>
                <PencilLine className="h-5 w-5" aria-hidden="true" />
                Korrigieren
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {postStep === "saved" ? (
        <Card className="flex flex-col gap-3">
          <div className="font-semibold">Gespeichert</div>
          <div className="opacity-80">
            {savedSummary.count === 1
              ? `1 Eintrag · ${formatHoursDE(savedSummary.totalHours)} Stunden`
              : `${savedSummary.count} Einträge · ${formatHoursDE(savedSummary.totalHours)} Stunden gesamt`}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="primary" onClick={resetAll}>
              Weiteren Eintrag
            </Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Zur Übersicht
            </Button>
          </div>
        </Card>
      ) : null}

      {parsing ? (
        <Card>
          <div className="font-semibold">Auswertung läuft…</div>
          <div className="mt-1 opacity-80">Bitte kurz warten.</div>
        </Card>
      ) : null}
    </div>
  );
}
