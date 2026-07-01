"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Entry } from "@/lib/types";

type TrackerDB = DBSchema & {
  entries: {
    key: string;
    value: Entry;
    indexes: { "by-date": string; "by-createdAt": string };
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
};

let dbPromise: Promise<IDBPDatabase<TrackerDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TrackerDB>("tracker-db", 4, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains("entries")) {
          const store = db.createObjectStore("entries", { keyPath: "id" });
          store.createIndex("by-date", "date");
          store.createIndex("by-createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }

        const entriesStore = tx.objectStore("entries");
        const all = await entriesStore.getAll();

        for (const e of all as unknown[]) {
          if (!e || typeof e !== "object") continue;
          const obj = e as Record<string, unknown>;
          let changed = false;

          if (oldVersion < 2) {
            if (!Array.isArray(obj.categories)) {
              obj.categories = [
                typeof obj.taskType === "string" ? obj.taskType : "Sonstiges",
              ];
            }
            delete (obj as { taskType?: unknown }).taskType;
            changed = true;
          }

          if (oldVersion < 3 && typeof obj.reminders !== "string") {
            obj.reminders = "";
            changed = true;
          }

          if (oldVersion < 4 && Array.isArray(obj.categories)) {
            const mapped = (obj.categories as string[]).map((c) =>
              c === "Buero" || c === "Büro" ? "Sonstiges" : c,
            );
            obj.categories = Array.from(new Set(mapped));
            changed = true;
          }

          if (changed || oldVersion < 2) {
            await entriesStore.put(obj as unknown as Entry);
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function listEntries(): Promise<Entry[]> {
  const db = await getDB();
  const all = await db.getAll("entries");
  // newest first
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return all;
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  const db = await getDB();
  return db.get("entries", id);
}

export async function upsertEntry(entry: Entry): Promise<void> {
  const db = await getDB();
  await db.put("entries", entry);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("entries", id);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear("entries");
  await db.clear("meta");
}

export async function exportAllEntries(): Promise<Entry[]> {
  return listEntries();
}

export async function importEntries(
  entries: Entry[],
): Promise<{ added: number; updated: number }> {
  const db = await getDB();
  const existingIds = new Set(await db.getAllKeys("entries"));
  const tx = db.transaction("entries", "readwrite");

  await Promise.all(entries.map((entry) => tx.store.put(entry)));
  await tx.done;

  const updated = entries.filter((entry) => existingIds.has(entry.id)).length;
  return { added: entries.length - updated, updated };
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.get("meta", key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put("meta", { key, value });
}

