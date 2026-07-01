"use client";

/**
 * Keeps the microphone audio session open on Android Chrome while SpeechRecognition
 * restarts between sessions — prevents audible gaps in the audio pipeline.
 */
let stream: MediaStream | null = null;
let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

export async function startMicKeepalive(): Promise<void> {
  if (stream) return;
  if (!navigator.mediaDevices?.getUserMedia) return;

  const next = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  stream = next;

  const el = document.createElement("audio");
  el.setAttribute("playsinline", "true");
  el.muted = true;
  el.srcObject = next;
  el.style.display = "none";
  document.body.appendChild(el);
  audioEl = el;
  await el.play().catch(() => {});

  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(next);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(ctx.destination);
    if (ctx.state === "suspended") await ctx.resume();
    audioCtx = ctx;
  } catch {
    // muted <audio> alone is enough on most devices
  }
}

export function stopMicKeepalive(): void {
  audioCtx?.close().catch(() => {});
  audioCtx = null;

  if (audioEl) {
    audioEl.pause();
    audioEl.srcObject = null;
    audioEl.remove();
    audioEl = null;
  }

  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
}
