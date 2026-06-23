"use client";

import { Download, Trash2 } from "lucide-react";
import { Button, Card, Input, OptionButton, SectionTitle } from "@/components/ui";
import { usePreferences } from "@/context/preferences-context";
import { clearAll, exportAllEntries } from "@/lib/db";

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

  async function backup() {
    const entries = await exportAllEntries();
    downloadJson({ exportedAt: new Date().toISOString(), entries }, "tracker-backup.json");
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
        <Button variant="danger" onClick={wipe} className="border-red-600">
          <Trash2 className="h-5 w-5" aria-hidden="true" />
          Alle Daten löschen
        </Button>
      </Card>
    </div>
  );
}

