"use client";

export type RecordingSupport = {
  supported: boolean;
};

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
];

export function pickRecordingMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export function getRecordingSupport(): RecordingSupport {
  if (typeof window === "undefined") return { supported: false };
  if (!navigator.mediaDevices?.getUserMedia) return { supported: false };
  if (!pickRecordingMimeType()) return { supported: false };
  return { supported: true };
}

export type AudioRecordingSession = {
  stop: () => Promise<Blob>;
  cancel: () => void;
  mimeType: string;
};

export async function startAudioRecording(): Promise<AudioRecordingSession> {
  const mimeType = pickRecordingMimeType();
  if (!mimeType) {
    throw new Error("Dieser Browser unterstützt keine Audioaufnahme.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType });

  const stopTracks = () => {
    for (const track of stream.getTracks()) track.stop();
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onerror = () => {
      stopTracks();
      reject(new Error("Aufnahme fehlgeschlagen."));
    };

    try {
      recorder.start(250);
    } catch {
      stopTracks();
      reject(new Error("Konnte Aufnahme nicht starten."));
      return;
    }

    resolve({
      mimeType,
      cancel: () => {
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
        }
        stopTracks();
      },
      stop: () =>
        new Promise((res, rej) => {
          const finish = () => {
            const blob = new Blob(chunks, { type: mimeType });
            stopTracks();
            res(blob);
          };

          recorder.onstop = () => {
            queueMicrotask(finish);
          };
          recorder.onerror = () => {
            stopTracks();
            rej(new Error("Aufnahme fehlgeschlagen."));
          };
          if (recorder.state === "inactive") {
            finish();
            return;
          }
          try {
            if (recorder.state === "recording") {
              recorder.requestData();
            }
            recorder.stop();
          } catch (e) {
            stopTracks();
            rej(e instanceof Error ? e : new Error("Aufnahme fehlgeschlagen."));
          }
        }),
    });
  });
}

export function recordingExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("aac")) return "aac";
  return "audio";
}
