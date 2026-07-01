"use client";

import { Check, Mic, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { applyCategoryRules } from "@/lib/category";
import type { Category, ParseEntryResponse } from "@/lib/types";
import { useVoiceCapture } from "@/lib/voice-capture";
import { isoToGermanDate } from "@/lib/time";

export type VoiceReplaceValues = {
  date: string;
  startTime: string;
  endTime: string;
  categories: Category[];
  name: string;
  notes: string;
  reminders: string;
};

type PanelStep = "capture" | "confirm";

export function VoiceReplaceEntry({
  open,
  onClose,
  onApply,
  existingValues,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (values: VoiceReplaceValues) => void;
  existingValues: VoiceReplaceValues;
}) {
  const voice = useVoiceCapture();
  const { reset: resetVoice, step, transcript, liveText, error: voiceError, start, stop, support } = voice;
  const parsedTranscriptRef = useRef<string | null>(null);
  const [panelStep, setPanelStep] = useState<PanelStep>("capture");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<VoiceReplaceValues | null>(null);
  const [multiEntryWarning, setMultiEntryWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      resetVoice();
      parsedTranscriptRef.current = null;
      setPanelStep("capture");
      setParseError(null);
      setParsing(false);
      setPreview(null);
      setMultiEntryWarning(null);
    }
  }, [open, resetVoice]);

  useEffect(() => {
    if (!open || panelStep !== "capture" || step !== "done") return;
    if (parsedTranscriptRef.current === transcript) return;
    parsedTranscriptRef.current = transcript;
    void parseTranscript(transcript);
  }, [open, panelStep, step, transcript]);

  async function parseTranscript(text: string) {
    setParseError(null);
    setParsing(true);
    setMultiEntryWarning(null);
    try {
      const res = await fetch("/api/parse-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, existingEntry: existingValues }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data?.error || "Auswertung fehlgeschlagen.");
        parsedTranscriptRef.current = null;
        resetVoice();
        setPanelStep("capture");
        return;
      }
      const { entries } = data as ParseEntryResponse;
      if (!entries?.length) {
        setParseError("Konnte Text nicht zuverlässig auswerten.");
        parsedTranscriptRef.current = null;
        resetVoice();
        setPanelStep("capture");
        return;
      }
      if (entries.length > 1) {
        setMultiEntryWarning(
          "Mehrere Einträge erkannt — es wird nur der erste übernommen. Weitere bitte separat anlegen.",
        );
      }
      const parsed = entries[0];
      const applied = await applyCategoryRules({
        transcript: text,
        name: parsed.name ?? "",
        notes: parsed.notes ?? "",
        fallbackCategories: parsed.categories ?? ["Sonstiges"],
      });
      setPreview({
        date: parsed.date,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        categories: applied.categories,
        name: parsed.name ?? "",
        notes: parsed.notes ?? "",
        reminders: parsed.reminders ?? "",
      });
      setPanelStep("confirm");
    } catch {
      setParseError("Keine Verbindung zur Auswertung. Bitte versuche es erneut.");
      parsedTranscriptRef.current = null;
      resetVoice();
      setPanelStep("capture");
    } finally {
      setParsing(false);
    }
  }

  function handleRetry() {
    parsedTranscriptRef.current = null;
    resetVoice();
    setPanelStep("capture");
    setParseError(null);
    setPreview(null);
    setMultiEntryWarning(null);
  }

  function handleCancel() {
    onClose();
  }

  function handleApply() {
    if (!preview) return;
    onApply(preview);
    onClose();
  }

  function toggleListening() {
    if (step === "ready") start();
    else if (step === "listening") stop();
  }

  if (!open) return null;

  const displayError = parseError ?? voiceError;

  return (
    <Card className="flex flex-col gap-3 border border-[var(--accent)]">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">Per Sprache ergänzen</div>
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Schließen"
          className="flex items-center justify-center rounded-[var(--radius)] text-[var(--muted)]"
          style={{ minHeight: "var(--tap-min)", minWidth: "var(--tap-min)" }}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {displayError ? (
        <div className="text-sm text-red-600">{displayError}</div>
      ) : null}

      {panelStep === "capture" ? (
        <>
          <div className="text-sm text-[var(--muted)]">
            Sprich nur die Ergänzungen — z. B. Name, Notiz oder korrigierte Zeiten. Bestehende
            Angaben bleiben erhalten.
          </div>

          {(step === "ready" || step === "listening") && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="text-base font-semibold">
                {step === "listening" ? "Aufnahme läuft…" : "Bereit zum Sprechen"}
              </div>
              <button
                type="button"
                onClick={toggleListening}
                className={[
                  "h-20 w-20 flex items-center justify-center rounded-full",
                  step === "listening"
                    ? "bg-[var(--accent)] text-white shadow-sm animate-pulse"
                    : "bg-[var(--card)] text-[var(--foreground)] border border-[var(--divider)]",
                ].join(" ")}
                aria-label={step === "listening" ? "Aufnahme stoppen" : "Aufnahme starten"}
                aria-pressed={step === "listening"}
              >
                <Mic className="h-9 w-9" aria-hidden="true" />
              </button>
              <div className="text-sm text-[var(--muted)] text-center">
                {step === "listening"
                  ? "Nochmal tippen, wenn du fertig bist."
                  : "Tippen zum Starten. Nochmal tippen zum Beenden."}
              </div>
              {step === "listening" && liveText ? (
                <div className="w-full rounded-[var(--radius)] bg-[var(--background)] p-3 text-sm">
                  {liveText}
                </div>
              ) : null}
            </div>
          )}

          {step === "processing" || parsing ? (
            <div className="text-sm text-[var(--muted)]">
              {parsing ? "Auswertung läuft…" : "Text wird verarbeitet…"}
            </div>
          ) : null}

          {step === "processing" && liveText ? (
            <div className="rounded-[var(--radius)] bg-[var(--background)] p-3 text-sm">{liveText}</div>
          ) : null}

          <Button variant="outline" onClick={handleCancel}>
            Abbrechen
          </Button>
        </>
      ) : null}

      {panelStep === "confirm" && preview ? (
        <>
          {multiEntryWarning ? (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-[var(--radius)] p-3">
              {multiEntryWarning}
            </div>
          ) : null}
          <div className="rounded-[var(--radius)] bg-[var(--background)] p-3 text-sm flex flex-col gap-2">
            <div>
              <span className="text-[var(--muted)]">Datum: </span>
              {isoToGermanDate(preview.date)}
            </div>
            <div>
              <span className="text-[var(--muted)]">Zeit: </span>
              {preview.startTime}–{preview.endTime}
            </div>
            <div>
              <span className="text-[var(--muted)]">Kategorien: </span>
              {preview.categories.join(", ")}
            </div>
            {preview.name ? (
              <div>
                <span className="text-[var(--muted)]">Name: </span>
                {preview.name}
              </div>
            ) : null}
            {preview.notes ? (
              <div>
                <span className="text-[var(--muted)]">Notiz: </span>
                {preview.notes}
              </div>
            ) : null}
            {preview.reminders ? (
              <div>
                <span className="text-[var(--muted)]">Später: </span>
                {preview.reminders}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="primary" onClick={handleApply}>
              <Check className="h-5 w-5" aria-hidden="true" />
              Übernehmen
            </Button>
            <Button variant="outline" onClick={handleRetry}>
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              Nochmal sprechen
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Abbrechen
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
