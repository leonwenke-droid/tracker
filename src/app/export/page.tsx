"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";
import { Button, Card, IconButton, ListCard, OptionButton, SectionTitle } from "@/components/ui";
import { usePreferences } from "@/context/preferences-context";
import type { Category, Entry } from "@/lib/types";
import { listEntries } from "@/lib/db";
import { countByTask, entriesForMonth, monthLabelDE, sumHours } from "@/lib/month";
import { formatGermanDateShort } from "@/lib/time";
import { buildEntriesPdfBlob, canSharePdf, downloadBlob, sharePdf } from "@/lib/pdf-export";

function formatHoursDE(h: number) {
  return h.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function categoryLabel(c: Category) {
  return c;
}

export default function ExportPage() {
  const { employeeName } = usePreferences();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const shareAvailable =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based

  useEffect(() => {
    listEntries().then(setEntries).catch(() => setEntries([]));
  }, []);

  const monthEntries = useMemo(() => entriesForMonth(entries, year, month), [entries, year, month]);
  const totalHours = useMemo(() => sumHours(monthEntries), [monthEntries]);
  const counts = useMemo(() => countByTask(monthEntries), [monthEntries]);
  const monthLabel = useMemo(() => monthLabelDE(year, month), [year, month]);
  const filename = useMemo(
    () => `Zeiterfassung_${year}-${String(month + 1).padStart(2, "0")}.pdf`,
    [year, month],
  );

  async function createPdfBlob() {
    const trimmedName = employeeName.trim();
    return buildEntriesPdfBlob({
      monthLabel,
      entries: monthEntries,
      totalHours,
      showNotes,
      employeeName: trimmedName || undefined,
    });
  }

  function prevMonth() {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() - 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }
  function nextMonth() {
    const d = new Date(year, month, 1);
    d.setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  async function downloadPdf() {
    setBusy(true);
    setError(null);
    try {
      const blob = await createPdfBlob();
      downloadBlob(blob, filename);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `PDF konnte nicht erstellt werden: ${msg}` : "PDF konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function sharePdfFile() {
    setShareBusy(true);
    setError(null);
    try {
      const blob = await createPdfBlob();
      if (!canSharePdf(blob, filename)) {
        downloadBlob(blob, filename);
        return;
      }
      await sharePdf(blob, filename);
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      try {
        const blob = await createPdfBlob();
        downloadBlob(blob, filename);
      } catch (inner: unknown) {
        const msg = inner instanceof Error ? inner.message : "";
        setError(msg ? `PDF konnte nicht geteilt werden: ${msg}` : "PDF konnte nicht geteilt werden.");
      }
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <IconButton onClick={prevMonth} aria-label="Vorheriger Monat">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <div className="text-lg font-bold capitalize">{monthLabel}</div>
        <IconButton onClick={nextMonth} aria-label="Nächster Monat">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </div>

      <section>
        <p className="section-label">Monatssumme</p>
        <p className="stat-ticker mt-2">{formatHoursDE(totalHours)}</p>
        <p className="mt-2 text-base text-[var(--muted)]">
          {monthEntries.length} Einträge
        </p>
      </section>

      {error ? (
        <Card className="border border-red-300">
          <div className="font-semibold">Hinweis</div>
          <div className="mt-1 text-[var(--muted)]">{error}</div>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <SectionTitle>Nach Kategorie</SectionTitle>
        <div className="flex flex-col gap-2 divide-y divide-[var(--divider)]">
          {(Object.keys(counts) as Category[]).map((c) => (
            <div key={c} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
              <div className="text-[var(--muted)]">{categoryLabel(c)}</div>
              <div className="font-semibold tabular-nums">{counts[c]}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>Notizen</SectionTitle>
        <div className="text-sm text-[var(--muted)]">
          Steuert die Vorschau und die PDF (Download & Teilen).
        </div>
        <div className="grid grid-cols-2 gap-2">
          <OptionButton active={showNotes} onClick={() => setShowNotes(true)}>
            Einblenden
          </OptionButton>
          <OptionButton active={!showNotes} onClick={() => setShowNotes(false)}>
            Ausblenden
          </OptionButton>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-2">
        <Button variant="primary" onClick={downloadPdf} disabled={busy || monthEntries.length === 0}>
          <Download className="h-5 w-5" aria-hidden="true" />
          PDF herunterladen
        </Button>
        {shareAvailable ? (
          <Button variant="outline" onClick={sharePdfFile} disabled={shareBusy || monthEntries.length === 0}>
            <Share2 className="h-5 w-5" aria-hidden="true" />
            PDF teilen
          </Button>
        ) : null}
        <div className="text-sm text-[var(--muted)]">Die PDF wird als Datei auf dein Gerät gespeichert.</div>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>Details</SectionTitle>
        {monthEntries.length === 0 ? (
          <Card>
            <div className="text-[var(--muted)]">Keine Einträge in diesem Monat.</div>
          </Card>
        ) : (
          <ListCard className="max-h-[50vh] overflow-auto">
            {monthEntries.map((e) => (
              <div key={e.id} className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold min-w-0">
                    {(e.categories ?? []).map(categoryLabel).join(", ")}
                    {e.name ? ` – ${e.name}` : ""}
                  </div>
                  <div className="shrink-0 font-bold text-[var(--accent)] tabular-nums">
                    {formatHoursDE(e.hours)}
                  </div>
                </div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {formatGermanDateShort(e.date)} · {e.startTime}–{e.endTime}
                </div>
                {showNotes && e.notes ? (
                  <div className="mt-2 text-[var(--foreground)]">{e.notes}</div>
                ) : null}
              </div>
            ))}
          </ListCard>
        )}
      </div>
    </div>
  );
}
