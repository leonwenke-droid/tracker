"use client";

export type SpeechSupport = {
  supported: boolean;
  ctorName: "SpeechRecognition" | "webkitSpeechRecognition" | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognition;
type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };

export function getSpeechSupport(): SpeechSupport {
  if (typeof window === "undefined") return { supported: false, ctorName: null };
  const w = window as SpeechWindow;
  if (typeof w.SpeechRecognition === "function")
    return { supported: true, ctorName: "SpeechRecognition" };
  if (typeof w.webkitSpeechRecognition === "function")
    return { supported: true, ctorName: "webkitSpeechRecognition" };
  return { supported: false, ctorName: null };
}

export function createSpeechRecognition(lang = "de-DE"): SpeechRecognition | null {
  const w = window as SpeechWindow;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: SpeechRecognition = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.continuous = true;
  return rec;
}

