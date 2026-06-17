"use client";

import type { Entry } from "@/lib/types";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function canSharePdf(blob: Blob, filename: string) {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
  try {
    const file = new File([blob], filename, { type: "application/pdf" });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function sharePdf(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  await navigator.share({ files: [file], title: "Tracker Export" });
}

export async function buildEntriesPdfBlob(input: {
  monthLabel: string;
  entries: Entry[];
  totalHours: number;
  showNotes?: boolean;
}): Promise<Blob> {
  const showNotes = input.showNotes ?? true;
  const [{ pdf }, { EntriesPdfDoc }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/app/export/pdf"),
  ]);

  const sorted = [...input.entries].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );

  const doc = (
    <EntriesPdfDoc
      monthLabel={input.monthLabel}
      entries={sorted}
      totalHours={input.totalHours}
      showNotes={showNotes}
    />
  );

  return pdf(doc).toBlob();
}
