import { NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { dedupeTranscript } from "@/lib/transcript-dedupe";

export const runtime = "nodejs";

function recordingExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("aac")) return "aac";
  return "audio";
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server ist nicht konfiguriert (OPENAI_API_KEY fehlt)." },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!audio || !(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Keine Audiodatei vorhanden." }, { status: 400 });
  }

  const mimeType = audio.type || "audio/webm";
  const ext = recordingExtension(mimeType);

  try {
    const client = new OpenAI({ apiKey });
    const transcription = await client.audio.transcriptions.create({
      file: await toFile(audio, `recording.${ext}`),
      model: "whisper-1",
      language: "de",
      temperature: 0,
    });

    const transcript = dedupeTranscript(transcription.text?.trim() ?? "");
    if (!transcript) {
      return NextResponse.json({ error: "Keine Sprache erkannt." }, { status: 422 });
    }

    return NextResponse.json({ transcript });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    console.error("[transcribe] failed", { message });
    return NextResponse.json(
      { error: "Transkription fehlgeschlagen.", details: message },
      { status: 500 },
    );
  }
}
