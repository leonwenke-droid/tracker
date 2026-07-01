"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { Button, Card, Input, OptionButton, SectionTitle } from "@/components/ui";
import { usePreferences } from "@/context/preferences-context";
import { clearAll, exportAllEntries, importEntries } from "@/lib/db";
import { parseEntriesBackup } from "@/lib/backup";

function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function SettingsPage() {
  const { fontSize, setFontSize, theme, setTheme, employeeName, setEmployeeName } = usePreferences();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function backup() {
    const entries = await exportAllEntries();
    downloadJson(
      { version: 1, exportedAt: new Date().toISOString(), entries },
      "tracker-backup.json",
    );
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportNotice(null);
    setImporting(true);

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Die Backup-Datei ist zu groß.");
      }

      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw new Error("Die Datei enthält kein gültiges JSON.");
      }

      const entries = parseEntriesBackup(raw);
      const confirmed = window.confirm(
        `${entries.length} Einträge importieren?\n\n` +
          "Vorhandene Einträge bleiben erhalten. Einträge mit derselben ID werden aktualisiert.",
      );
      if (!confirmed) return;

      const result = await importEntries(entries);
      setImportNotice({
        kind: "success",
        text: `Import erfolgreich: ${result.added} neu, ${result.updated} aktualisiert.`,
      });
    } catch (error: unknown) {
      setImportNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Import fehlgeschlagen.",
      });
    } finally {
      setImporting(false);
    }
  }

  async function wipe() {
    const ok = window.confirm("Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.");
    if (!ok) return;
    await clearAll();
    window.location.href = "/";
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Einstellungen</SectionTitle>

      <Card className="flex flex-col gap-3">
        <div className="font-semibold">Mitarbeiter/in</div>
        <div className="text-sm text-[var(--muted)]">
          Erscheint auf dem PDF-Export. Wichtig, wenn mehrere Personen dasselbe Gerät nutzen.
        </div>
        <Input
          label="Name"
          value={employeeName}
          onChange={setEmployeeName}
          placeholder="z.B. Maria Schmidt"
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="font-semibold">Schriftgröße</div>
        <div className="grid grid-cols-1 gap-2">
          <OptionButton active={fontSize === "normal"} onClick={() => setFontSize("normal")}>
            Normal
          </OptionButton>
          <OptionButton active={fontSize === "large"} onClick={() => setFontSize("large")}>
            Groß
          </OptionButton>
          <OptionButton
            active={fontSize === "extra-large"}
            onClick={() => setFontSize("extra-large")}
          >
            Extra
          </OptionButton>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="font-semibold">Erscheinungsbild</div>
        <div className="grid grid-cols-1 gap-2">
          <OptionButton active={theme === "light"} onClick={() => setTheme("light")}>
            Hell
          </OptionButton>
          <OptionButton active={theme === "dark"} onClick={() => setTheme("dark")}>
            Dunkel
          </OptionButton>
          <OptionButton active={theme === "high-contrast"} onClick={() => setTheme("high-contrast")}>
            Hoher Kontrast
          </OptionButton>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="text-lg font-semibold">Daten</div>
        <Button variant="outline" onClick={backup}>
          <Download className="h-5 w-5" aria-hidden="true" />
          Alle Einträge als Datei sichern
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={restoreBackup}
          aria-label="Backup-Datei auswählen"
        />
        <Button
          variant="outline"
          onClick={() => importInputRef.current?.click()}
          disabled={importing}
        >
          <Upload className="h-5 w-5" aria-hidden="true" />
          {importing ? "Backup wird importiert…" : "Backup-Datei importieren"}
        </Button>
        <div className="text-sm text-[var(--muted)]">
          Vorhandene Einträge bleiben erhalten. Gleiche Einträge werden aktualisiert.
        </div>
        {importNotice ? (
          <div
            role={importNotice.kind === "error" ? "alert" : "status"}
            className={
              importNotice.kind === "error"
                ? "text-sm text-red-700"
                : "text-sm text-[var(--foreground)]"
            }
          >
            {importNotice.text}
          </div>
        ) : null}
        <Button variant="danger" onClick={wipe} className="border-red-600">
          <Trash2 className="h-5 w-5" aria-hidden="true" />
          Alle Daten löschen
        </Button>
      </Card>
    </div>
  );
}
