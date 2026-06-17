"use client";

import { v4 as uuidv4 } from "uuid";
import type { Entry } from "@/lib/types";
import { setMeta, getMeta, upsertEntry } from "@/lib/db";
import { toISODate } from "@/lib/time";

const SEEDED_KEY = "seeded.v1";

function isoNow() {
  return new Date().toISOString();
}

export async function ensureSeedData() {
  const seeded = await getMeta(SEEDED_KEY);
  if (seeded === "true") return;

  const today = new Date();
  const d1 = new Date(today);
  d1.setDate(today.getDate() - 1);
  const d2 = new Date(today);
  d2.setDate(today.getDate() - 3);

  const examples: Entry[] = [
    {
      id: uuidv4(),
      date: toISODate(today),
      startTime: "08:00",
      endTime: "12:30",
      hours: 4.5,
      categories: ["Buero"],
      name: "",
      notes: "Telefonate, Unterlagen vorbereitet.",
      reminders: "",
      createdAt: isoNow(),
    },
    {
      id: uuidv4(),
      date: toISODate(d1),
      startTime: "13:00",
      endTime: "17:00",
      hours: 4,
      categories: ["Fahrdienst", "Krematorium"],
      name: "",
      notes: "Abholung und Fahrt zum Krematorium.",
      reminders: "",
      createdAt: isoNow(),
    },
    {
      id: uuidv4(),
      date: toISODate(d2),
      startTime: "09:15",
      endTime: "14:15",
      hours: 5,
      categories: ["Aufbahrung"],
      name: "M. Beispiel",
      notes: "Aufbahrung vorbereitet, Blumen arrangiert.",
      reminders: "",
      createdAt: isoNow(),
    },
  ];

  for (const e of examples) {
    await upsertEntry(e);
  }
  await setMeta(SEEDED_KEY, "true");
}

