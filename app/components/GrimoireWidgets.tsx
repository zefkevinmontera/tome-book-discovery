"use client";

import { useState } from "react";
import ShelfSelector from "@/app/components/ShelfSelector";
import BookJournalNote from "@/app/components/BookJournalNote";
import { uniqueShelves, type BookRef, type GrimoireEntry } from "@/lib/grimoire";

interface GrimoireWidgetsProps {
  book: BookRef;
  initialEntry: GrimoireEntry | null;
  initialShelves: string[];
}

export default function GrimoireWidgets({
  book,
  initialEntry,
  initialShelves,
}: GrimoireWidgetsProps) {
  const [entry, setEntry] = useState<GrimoireEntry | null>(initialEntry);
  const [shelves, setShelves] = useState<string[]>(initialShelves);

  function handleShelfChange(next: GrimoireEntry | null) {
    setEntry(next);
    if (next?.custom_shelf) {
      setShelves((prev) =>
        uniqueShelves([...prev.map((s) => ({ custom_shelf: s })), { custom_shelf: next.custom_shelf }])
      );
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ShelfSelector
        variant="full"
        book={book}
        entry={entry}
        shelves={shelves}
        onChange={handleShelfChange}
      />
      <BookJournalNote
        book={book}
        initialNotes={entry?.notes ?? null}
        onSaved={setEntry}
      />
    </div>
  );
}