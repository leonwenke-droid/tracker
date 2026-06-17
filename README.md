# Zeiterfassung – Arbeitszeiten erfassen

PWA für Zeiterfassung im Bestattungsunternehmen (Deutsch, lokal im Browser, Spracheingabe mit KI-Auswertung).

## Lokal starten

```bash
npm install
cp .env.example .env.local   # OPENAI_API_KEY eintragen
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

## Umgebungsvariablen

| Variable | Beschreibung |
|----------|--------------|
| `OPENAI_API_KEY` | Für Sprachtranskription (`/api/transcribe`) und Eintrags-Auswertung (`/api/parse-entry`) |

## Deploy auf Vercel

1. Repo mit [Vercel](https://vercel.com/new) verbinden (Root: `tracker` falls Monorepo, sonst Repo-Root).
2. **Environment Variable** setzen: `OPENAI_API_KEY`
3. Deploy — Next.js wird automatisch erkannt.

Einträge liegen in **IndexedDB im Browser** (nicht auf dem Server). Backup über Einstellungen → JSON-Export.
