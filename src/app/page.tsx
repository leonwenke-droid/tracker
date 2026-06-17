"use client";

import Link from "next/link";
import { Mic, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Entry } from "@/lib/types";
import { listEntries } from "@/lib/db";
import { monthKey, relativeGermanDate } from "@/lib/time";
import { useSeedData } from "@/hooks/use-seed";
import { Button, Card, ListCard, ListRow, SectionTitle } from "@/components/ui";

function formatHoursDE(h: number) {
  return h.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

export default function HomePage() {
  useSeedData();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    listEntries().then(setEntries).catch(() => setEntries([]));
  }, []);

  const thisMonthKey = monthKey(new Date().toISOString().slice(0, 10));
  const monthEntries = useMemo(
    () => entries.filter((e) => monthKey(e.date) === thisMonthKey),
    [entries, thisMonthKey],
  );
  const monthTotal = useMemo(
    () => monthEntries.reduce((sum, e) => sum + (Number.isFinite(e.hours) ? e.hours : 0), 0),
    [monthEntries],
  );
  const recent = entries.slice(0, 6);

  return (
    <div className="flex flex-col gap-8">
      <section className="pt-4 pb-2">
        <p className="section-label">Dieser Monat</p>
        <p className="stat-ticker mt-2">{formatHoursDE(monthTotal)}</p>
        <p className="mt-2 text-base text-[var(--muted)]">Stunden insgesamt</p>
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
        <SectionTitle>Letzte Einträge</SectionTitle>

        {recent.length === 0 ? (
          <Card>
            <div className="font-semibold">Noch keine Einträge</div>
            <div className="mt-1 text-[var(--muted)]">
              Starte mit „Spracheingabe“ oder „Manuell eintragen“.
            </div>
          </Card>
        ) : (
          <ListCard>
            {recent.map((e) => (
              <ListRow
                key={e.id}
                href={`/eintrag/${e.id}`}
                title={
                  <>
                    {(e.categories ?? []).join(", ")}
                    {e.name ? ` – ${e.name}` : ""}
                  </>
                }
                subtitle={relativeGermanDate(e.date)}
                trailing={formatHoursDE(e.hours)}
              />
            ))}
          </ListCard>
        )}
      </div>
    </div>
  );
}
