"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, RotateCcw, Check, Save, PencilLine, ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button, Card, IconButton, Input, ListCard, ListRow, OptionButton, Textarea } from "@/components/ui";
import type { Category, Entry, ParseEntryResponse } from "@/lib/types";
import { upsertEntry } from "@/lib/db";
import { calcHours } from "@/lib/time";
import { createSpeechRecognition, getSpeechSupport } from "@/lib/speech";
import { applyCategoryRules, learnCategoryRules } from "@/lib/category";

type Step = "ready" | "listening" | "processing" | "transcript" | "review" | "parsed" | "saved";

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

const FINALIZE_DELAY_MS = 900;
const FINALIZE_MAX_WAIT_MS = 3500;

/** Append a speech segment without duplicating overlapping prefix (Chrome cumulative finals). */
function appendWithOverlap(accumulated: string, segment: string): string {
  const seg = segment.trim();
  if (!seg) return accumulated;
  const acc = accumulated.trim();
  if (!acc) return seg;

  const accWords = acc.split(/\s+/);
  const segWords = seg.split(/\s+/);
  const maxOverlap = Math.min(accWords.length, segWords.length);

  let overlap = 0;
  for (let k = maxOverlap; k >= 1; k--) {
    const accSuffix = accWords.slice(-k).map((w) => w.toLowerCase());
    const segPrefix = segWords.slice(0, k).map((w) => w.toLowerCase());
    if (accSuffix.every((w, i) => w === segPrefix[i])) {
      overlap = k;
      break;
    }
  }

  const newWords = segWords.slice(overlap);
  if (newWords.length === 0) return acc;
  return `${acc} ${newWords.join(" ")}`;
}

function transcriptFromResults(results: SpeechRecognitionResultList): string {
  let accumulated = "";
  let interim = "";
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const text = String(r?.[0]?.transcript ?? "").trim();
    if (!text) continue;
    if (r.isFinal) {
      accumulated = appendWithOverlap(accumulated, text);
    } else {
      interim = text;
    }
  }
  if (interim) {
    accumulated = appendWithOverlap(accumulated, interim);
  }
  return accumulated;
}

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

function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime}–${endTime}`;
}

export default function SprechenPage() {
  const router = useRouter();
  const support = useMemo(() => getSpeechSupport(), []);
  const recRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef<string>("");
  const baseTranscriptRef = useRef<string>("");
  const listeningActiveRef = useRef(false);
  const stoppingRef = useRef(false);
  const finalizeTimerRef = useRef<number | null>(null);
  const finalizeDeadlineRef = useRef<number>(0);
  const savedSummaryRef = useRef({ count: 0, totalHours: 0 });

  const [step, setStep] = useState<Step>("ready");
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
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

  function clearFinalizeTimer() {
    if (finalizeTimerRef.current !== null) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  }

  function finalizeTranscript() {
    clearFinalizeTimer();
    stoppingRef.current = false;
    listeningActiveRef.current = false;
    const finalText = transcriptRef.current.trim();
    setLiveText("");
    if (!finalText) {
      setStep("ready");
      return;
    }
    setTranscript(finalText);
    setStep("transcript");
  }

  function scheduleFinalize() {
    clearFinalizeTimer();
    const now = Date.now();
    const deadline = finalizeDeadlineRef.current;
    if (now >= deadline) {
      finalizeTranscript();
      return;
    }
    const delay = Math.min(FINALIZE_DELAY_MS, deadline - now);
    finalizeTimerRef.current = window.setTimeout(() => {
      finalizeTimerRef.current = null;
      finalizeTranscript();
    }, delay);
  }

  useEffect(() => {
    return () => {
      clearFinalizeTimer();
      try {
        recRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  function resetAll() {
    clearFinalizeTimer();
    stoppingRef.current = false;
    listeningActiveRef.current = false;
    setError(null);
    setTranscript("");
    setLiveText("");
    transcriptRef.current = "";
    baseTranscriptRef.current = "";
    setParsing(false);
    setSaving(false);
    setDrafts([]);
    setActiveIndex(0);
    savedSummaryRef.current = { count: 0, totalHours: 0 };
    setSavedSummary({ count: 0, totalHours: 0 });
    setStep("ready");
  }

  function updateActiveDraft(patch: Partial<DraftEntry>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === activeIndex ? { ...d, ...patch } : d)),
    );
  }

  function restartRecognition(rec: SpeechRecognition) {
    if (!listeningActiveRef.current || stoppingRef.current) return;
    baseTranscriptRef.current = transcriptRef.current;
    const attempt = () => {
      if (!listeningActiveRef.current || stoppingRef.current) return;
      try {
        rec.start();
      } catch {
        window.setTimeout(attempt, 150);
      }
    };
    window.setTimeout(attempt, 50);
  }

  function startListening() {
    setError(null);
    if (!support.supported) {
      setError("Dein Browser unterstützt keine Spracherkennung. Bitte nutze „Manuell eintragen“.");
      return;
    }
    const rec = createSpeechRecognition("de-DE");
    if (!rec) {
      setError("Spracherkennung ist nicht verfügbar. Bitte nutze „Manuell eintragen“.");
      return;
    }
    rec.continuous = true;
    rec.interimResults = true;
    stoppingRef.current = false;
    listeningActiveRef.current = true;
    transcriptRef.current = "";
    baseTranscriptRef.current = "";
    setLiveText("");
    recRef.current = rec;
    setStep("listening");

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const sessionText = transcriptFromResults(event.results);
      const combined = baseTranscriptRef.current
        ? appendWithOverlap(baseTranscriptRef.current, sessionText)
        : sessionText;
      transcriptRef.current = combined;
      setLiveText(combined);
      if (stoppingRef.current) scheduleFinalize();
    };
    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = String(event.error ?? "");
      if (stoppingRef.current && code === "no-speech") {
        scheduleFinalize();
        return;
      }
      if (!stoppingRef.current && (code === "no-speech" || code === "network")) {
        restartRecognition(rec);
        return;
      }
      clearFinalizeTimer();
      stoppingRef.current = false;
      listeningActiveRef.current = false;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Mikrofon-Zugriff abgelehnt. Bitte erlaube das Mikrofon in den Browser-Einstellungen.");
      } else if (code === "no-speech") {
        setError("Keine Sprache erkannt. Bitte sprich etwas lauter oder näher am Mikrofon.");
      } else if (code === "audio-capture") {
        setError("Kein Mikrofon gefunden. Bitte prüfe dein Gerät.");
      } else if (code !== "aborted") {
        setError("Spracherkennung fehlgeschlagen. Bitte versuche es erneut oder nutze „Manuell eintragen“.");
      }
      setStep("ready");
    };
    rec.onend = () => {
      if (stoppingRef.current) {
        scheduleFinalize();
        return;
      }
      if (listeningActiveRef.current) {
        restartRecognition(rec);
        return;
      }
      setStep((s) => (s === "listening" ? "ready" : s));
    };

    try {
      rec.start();
    } catch {
      listeningActiveRef.current = false;
      setError("Konnte Spracherkennung nicht starten. Bitte nutze „Manuell eintragen“.");
      setStep("ready");
    }
  }

  function stopListening() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    finalizeDeadlineRef.current = Date.now() + FINALIZE_MAX_WAIT_MS;
    setStep("processing");
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    scheduleFinalize();
  }

  async function buildDraftsFromResponse(entries: ParseEntryResponse["entries"]): Promise<DraftEntry[]> {
    return Promise.all(
      entries.map(async (parsed) => {
        const applied = await applyCategoryRules({
          transcript,
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
    setError(null);
    setParsing(true);
    try {
      const res = await fetch("/api/parse-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Auswertung fehlgeschlagen.");
        setParsing(false);
        return;
      }
      const { entries } = data as ParseEntryResponse;
      if (!entries?.length) {
        setError("Konnte Text nicht zuverlässig auswerten.");
        setParsing(false);
        return;
      }
      const nextDrafts = await buildDraftsFromResponse(entries);
      setDrafts(nextDrafts);
      setActiveIndex(0);
      setStep(nextDrafts.length > 1 ? "review" : "parsed");
    } catch {
      setError("Keine Verbindung zur Auswertung. Bitte versuche es erneut.");
    } finally {
      setParsing(false);
    }
  }

  function openDraft(index: number) {
    setActiveIndex(index);
    setStep("parsed");
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
      transcript,
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
    setError(null);
    const validationError = validateDraft(activeDraft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const hours = await persistDraft(activeDraft);
      recordSaved(hours);
      const remaining = drafts.filter((_, i) => i !== activeIndex);
      setDrafts(remaining);
      if (remaining.length === 0) {
        setStep("saved");
        router.refresh();
      } else {
        setActiveIndex(0);
        setStep("review");
        router.refresh();
      }
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAllEntries() {
    setError(null);
    for (const draft of drafts) {
      const validationError = validateDraft(draft);
      if (validationError) {
        setError(validationError);
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
      setStep("saved");
      router.refresh();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  function toggleListening() {
    if (step === "ready") startListening();
    else if (step === "listening") stopListening();
  }

  const micButtonClass =
    step === "listening"
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
          <div className="text-sm text-[var(--muted)]">Bitte kurz und deutlich sprechen.</div>
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

      {step === "ready" || step === "listening" ? (
        <Card className="flex flex-col items-center gap-4 py-8">
          <div className="text-base font-semibold">
            {step === "listening" ? "Aufnahme läuft…" : "Bereit zum Sprechen"}
          </div>
          <button
            type="button"
            onClick={toggleListening}
            disabled={step !== "ready" && step !== "listening"}
            className={[
              "h-24 w-24 flex items-center justify-center rounded-full",
              micButtonClass,
              step === "listening" ? "animate-pulse" : "",
            ].join(" ")}
            aria-label={step === "listening" ? "Aufnahme stoppen" : "Aufnahme starten"}
            aria-pressed={step === "listening"}
          >
            <Mic className="h-10 w-10" aria-hidden="true" />
          </button>
          <div className="text-sm text-[var(--muted)] text-center">
            {step === "listening"
              ? "Nochmal tippen, um die Aufnahme zu beenden."
              : "Tippen zum Starten. Nochmal tippen zum Stoppen."}
          </div>
          {step === "listening" && liveText ? (
            <div className="w-full rounded-[var(--radius)] bg-[var(--background)] p-3 text-sm">{liveText}</div>
          ) : null}
          {!support.supported ? (
            <div className="text-sm text-[var(--muted)] text-center">
              Dein Browser unterstützt keine Spracherkennung.
            </div>
          ) : null}
        </Card>
      ) : null}

      {step === "processing" ? (
        <Card className="flex flex-col gap-3">
          <div className="font-semibold">Text wird verarbeitet…</div>
          <div className="text-sm opacity-80">
            Bitte kurz warten – der letzte Teil deiner Sprache wird noch erfasst.
          </div>
          {liveText ? (
            <div className="rounded-[var(--radius)] bg-[var(--background)] p-3">{liveText}</div>
          ) : (
            <div className="rounded-[var(--radius)] bg-[var(--background)] p-3 text-[var(--muted)]">…</div>
          )}
        </Card>
      ) : null}

      {step === "transcript" ? (
        <Card className="flex flex-col gap-3">
          <div className="font-semibold">Stimmt das so?</div>
          <div className="rounded-[var(--radius)] bg-[var(--background)] p-3">{transcript}</div>
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

      {step === "review" ? (
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
            <Button variant="outline" onClick={() => setStep("transcript")} disabled={saving}>
              <PencilLine className="h-5 w-5" aria-hidden="true" />
              Zurück zum Text
            </Button>
          </div>
        </div>
      ) : null}

      {step === "parsed" && activeDraft ? (
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
              <Input
                label="Datum (YYYY-MM-DD)"
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
              <Button variant="outline" onClick={() => setStep("review")} disabled={saving}>
                <ChevronRight className="h-5 w-5 rotate-180" aria-hidden="true" />
                Zurück zur Übersicht
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStep("transcript")} disabled={saving}>
                <PencilLine className="h-5 w-5" aria-hidden="true" />
                Korrigieren
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === "saved" ? (
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
