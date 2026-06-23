"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSpeechRecognition, getSpeechSupport } from "@/lib/speech";

export type VoiceCaptureStep = "ready" | "listening" | "processing" | "done";

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

export function useVoiceCapture() {
  const support = useMemo(() => getSpeechSupport(), []);

  const recRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const baseTranscriptRef = useRef("");
  const listeningActiveRef = useRef(false);
  const stoppingRef = useRef(false);
  const finalizeTimerRef = useRef<number | null>(null);
  const finalizeDeadlineRef = useRef(0);
  const restartAttemptsRef = useRef(0);

  const [step, setStep] = useState<VoiceCaptureStep>("ready");
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current !== null) {
      window.clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
  }, []);

  const finalizeTranscript = useCallback(() => {
    clearFinalizeTimer();
    stoppingRef.current = false;
    listeningActiveRef.current = false;
    restartAttemptsRef.current = 0;
    const finalText = transcriptRef.current.trim();
    setLiveText("");
    if (!finalText) {
      setTranscript("");
      setStep("ready");
      return;
    }
    setTranscript(finalText);
    setStep("done");
  }, [clearFinalizeTimer]);

  const safetyNetAfterRestartFailure = useCallback(() => {
    listeningActiveRef.current = false;
    restartAttemptsRef.current = 0;
    const text = transcriptRef.current.trim();
    if (text) {
      stoppingRef.current = true;
      finalizeDeadlineRef.current = Date.now();
      setStep("processing");
      finalizeTranscript();
    } else {
      setStep("ready");
    }
  }, [finalizeTranscript]);

  const scheduleFinalize = useCallback(() => {
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
  }, [clearFinalizeTimer, finalizeTranscript]);

  const restartRecognition = useCallback(
    (rec: SpeechRecognition) => {
      if (!listeningActiveRef.current || stoppingRef.current) return;
      baseTranscriptRef.current = transcriptRef.current;

      const attempt = () => {
        if (!listeningActiveRef.current || stoppingRef.current) return;
        try {
          rec.start();
          restartAttemptsRef.current = 0;
        } catch {
          restartAttemptsRef.current += 1;
          if (restartAttemptsRef.current < 4) {
            window.setTimeout(attempt, 150);
            return;
          }
          safetyNetAfterRestartFailure();
        }
      };

      window.setTimeout(attempt, 50);
    },
    [safetyNetAfterRestartFailure],
  );

  const reset = useCallback(() => {
    clearFinalizeTimer();
    stoppingRef.current = false;
    listeningActiveRef.current = false;
    restartAttemptsRef.current = 0;
    transcriptRef.current = "";
    baseTranscriptRef.current = "";
    setLiveText("");
    setTranscript("");
    setError(null);
    setStep("ready");
    try {
      recRef.current?.abort();
    } catch {
      // ignore
    }
    recRef.current = null;
  }, [clearFinalizeTimer]);

  const start = useCallback(() => {
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
    restartAttemptsRef.current = 0;
    transcriptRef.current = "";
    baseTranscriptRef.current = "";
    setLiveText("");
    setTranscript("");
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
  }, [clearFinalizeTimer, restartRecognition, scheduleFinalize, support.supported]);

  const stop = useCallback(() => {
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
  }, [scheduleFinalize]);

  useEffect(() => {
    return () => {
      clearFinalizeTimer();
      try {
        recRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, [clearFinalizeTimer]);

  return {
    support: { supported: support.supported },
    step,
    liveText,
    error,
    transcript,
    start,
    stop,
    reset,
  };
}
