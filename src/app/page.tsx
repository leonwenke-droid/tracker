"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Mic, PencilLine } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Entry } from "@/lib/types";
import { listEntries } from "@/lib/db";
import { formatGermanDateShort } from "@/lib/time";
import { entriesForMonth, monthLabelDE, sumHours } from "@/lib/month";
import { useSeedData } from "@/hooks/use-seed";
import { Button, Card, IconButton, ListCard, ListRow, SectionTitle } from "@/components/ui";

function formatHoursDE(h: number) {
  return h.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function selectedMonth(raw: string | null, now: Date) {
  const current = { year: now.getFullYear(), month: now.getMonth() };
  const match = /^(\d{4})-(\d{2})$/.exec(raw ?? "");
  if (!match) return current;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const requestedIndex = year * 12 + month;
  const currentIndex = current.year * 12 + current.month;
  if (month < 0 || month > 11 || requestedIndex > currentIndex) return current;

  return { year, month };
}

function monthParam(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function HomeContent() {
  useSeedData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<Entry[]>([]);
  const now = new Date();
  const { year, month } = selectedMonth(searchParams.get("month"), now);
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const selectedMonthIndex = year * 12 + month;
  const isCurrentMonth = selectedMonthIndex === currentMonthIndex;
  const selectedKey = monthParam(year, month);

  useEffect(() => {
    listEntries().then(setEntries).catch(() => setEntries([]));
  }, []);

  const monthEntries = useMemo(() => {
    return entriesForMonth(entries, year, month).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.startTime !== b.startTime) return b.startTime.localeCompare(a.startTime);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [entries, year, month]);
  const monthTotal = useMemo(() => sumHours(monthEntries), [monthEntries]);
  const monthLabel = useMemo(() => monthLabelDE(year, month), [year, month]);

  function changeMonth(offset: -1 | 1) {
    const next = new Date(year, month + offset, 1);
    const nextIndex = next.getFullYear() * 12 + next.getMonth();
    if (nextIndex > currentMonthIndex) return;
    router.replace(`/?month=${monthParam(next.getFullYear(), next.getMonth())}`, {
      scroll: false,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="pt-4 pb-2 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <IconButton onClick={() => changeMonth(-1)} aria-label="Vorheriger Monat">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </IconButton>
          <div className="min-w-0 text-center">
            <p className="section-label">{isCurrentMonth ? "Dieser Monat" : "Monat"}</p>
            <p className="mt-1 text-lg font-bold capitalize">{monthLabel}</p>
          </div>
          <IconButton
            onClick={() => changeMonth(1)}
            disabled={isCurrentMonth}
            aria-label="Nächster Monat"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
        <p className="stat-ticker mt-2">{formatHoursDE(monthTotal)}</p>
        <p className="text-base text-[var(--muted)]">
          {monthEntries.length} {monthEntries.length === 1 ? "Eintrag" : "Einträge"}
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <Link href="/sprechen" className="block">
          <Button variant="primary">
            <Mic className="h-5 w-5" aria-hidden="true" />
            Spracheingabe
          </Button>
        </Link>
        <Link href="/manuell" className="block">
          <Button variant="outline">
            <PencilLine className="h-5 w-5" aria-hidden="true" />
            Manuell eintragen
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>Einträge im Monat</SectionTitle>

        {monthEntries.length === 0 ? (
          <Card>
            <div className="font-semibold">Keine Einträge in diesem Monat</div>
            <div className="mt-1 text-[var(--muted)]">
              Mit dem Pfeil links kannst du frühere Monate öffnen.
            </div>
          </Card>
        ) : (
          <ListCard>
            {monthEntries.map((e) => (
              <ListRow
                key={e.id}
                href={`/eintrag/${e.id}?returnMonth=${selectedKey}`}
                title={
                  <>
                    {(e.categories ?? []).join(", ")}
                    {e.name ? ` – ${e.name}` : ""}
                  </>
                }
                subtitle={`${formatGermanDateShort(e.date)} · ${e.startTime}–${e.endTime}`}
                trailing={formatHoursDE(e.hours)}
              />
            ))}
          </ListCard>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
