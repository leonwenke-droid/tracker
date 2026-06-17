/** Reduce duplicated phrases common in Whisper output after pauses. */
export function dedupeTranscript(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  if (!t) return "";

  // "ich ich", "von 15 von 15"
  t = t.replace(/\b(\S+)(\s+\1\b)+/gi, "$1");

  const words = t.split(" ");

  // Entire second half repeats first half: "A B C D A B C D"
  for (let len = Math.floor(words.length / 2); len >= 4; len--) {
    const first = words
      .slice(0, len)
      .join(" ")
      .toLowerCase();
    const second = words
      .slice(len, len * 2)
      .join(" ")
      .toLowerCase();
    if (first === second) {
      return words.slice(0, len).join(" ");
    }
  }

  // Trailing chunk repeats an earlier passage (common after long pauses in Whisper)
  for (let window = Math.min(Math.floor(words.length / 2), 16); window >= 3; window--) {
    const endPhrase = words
      .slice(-window)
      .join(" ")
      .toLowerCase();
    const beforeEnd = words.slice(0, -window).join(" ").toLowerCase();
    if (beforeEnd.endsWith(endPhrase)) {
      return words.slice(0, -window).join(" ");
    }
  }

  const parts = t.split(/(?<=[,.!?])\s+/);
  const kept: string[] = [];
  for (const part of parts) {
    const norm = part.trim().toLowerCase();
    if (!norm) continue;
    const prev = kept[kept.length - 1]?.trim().toLowerCase();
    if (prev === norm) continue;
    kept.push(part.trim());
  }

  return kept.join(" ").trim() || t;
}
