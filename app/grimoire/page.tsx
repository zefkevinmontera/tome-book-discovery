"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, NotebookPen, ScrollText, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  LIST_COLUMNS,
  STATUS_OPTIONS,
  STATUS_SHORT,
  sameShelf,
  uniqueShelves,
  type BookRef,
  type GrimoireEntry,
  type GrimoireListEntry,
  type ReadingStatus,
} from "@/lib/grimoire";
import Header from "@/app/components/Header";
import TiltBookCard from "@/app/components/TiltBookCard";
import Manifest from "@/app/components/Manifest";
import ShelfSelector, { STATUS_ICON } from "@/app/components/ShelfSelector";
import { BookJournalDrawer } from "@/app/components/BookJournalNote";

type StatusFilter = "all" | ReadingStatus;

const TABS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  ...STATUS_OPTIONS.map(({ value, label }) => ({ value, label })),
];

function toRef(entry: GrimoireListEntry): BookRef {
  return {
    id: entry.book_id,
    title: entry.book_title,
    author: entry.book_author,
    cover: entry.book_cover,
  };
}

/* -------------------------------------------------------------------------- */
/*                               Small card pieces                            */
/* -------------------------------------------------------------------------- */

function CardMeta({
  entry,
  onOpenJournal,
}: {
  entry: GrimoireListEntry;
  onOpenJournal: () => void;
}) {
  const Icon = STATUS_ICON[entry.status];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-700/30 px-2 py-0.5 text-xs text-amber-200/80">
          <Icon className="h-3 w-3" aria-hidden />
          {STATUS_SHORT[entry.status]}
        </span>
        {entry.custom_shelf && (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-900/40 bg-black/20 px-2 py-0.5 text-xs text-[#D4C5B9]">
            <Tag className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{entry.custom_shelf}</span>
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenJournal}
        className="inline-flex items-center gap-1.5 text-xs text-[#D4C5B9]/80 transition-colors hover:text-amber-300"
      >
        <NotebookPen className="h-3.5 w-3.5" aria-hidden />
        {entry.has_notes ? "Read journal" : "Add a note"}
      </button>
    </div>
  );
}

function NotesIndicator({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open your journal notes for ${title}`}
      title="You have notes on this tome"
      className="grid h-8 w-8 place-items-center rounded-full bg-black/55 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.35)] ring-1 ring-amber-500/40 backdrop-blur transition-colors hover:bg-black/75 hover:ring-amber-500/70"
    >
      <ScrollText className="h-4 w-4" aria-hidden />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function GrimoirePage() {
  const [entries, setEntries] = useState<GrimoireListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoggedIn, setUserLoggedIn] = useState(false);

  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [activeShelf, setActiveShelf] = useState<string | null>(null);
  // Cards the reader just re-shelved stay visible until the filter changes, so
  // the shelf dialog doesn't vanish from under the cursor mid-interaction.
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const [journalBook, setJournalBook] = useState<BookRef | null>(null);

  useEffect(() => {
    async function loadGrimoire() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserLoggedIn(false);
        setLoading(false);
        return;
      }

      setUserLoggedIn(true);

      const { data, error } = await supabase
        .from("grimoire_entries")
        .select(LIST_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setEntries(data as unknown as GrimoireListEntry[]);
      }
      setLoading(false);
    }

    loadGrimoire();
  }, []);

  const handleEntryChange = useCallback((bookId: string, next: GrimoireEntry | null) => {
    if (next === null) {
      setEntries((prev) => prev.filter((e) => e.book_id !== bookId));
      return;
    }
    setLingering((prev) => new Set(prev).add(bookId));
    setEntries((prev) =>
      prev.map((e) =>
        e.book_id === bookId
          ? {
              ...e,
              status: next.status,
              custom_shelf: next.custom_shelf,
              has_notes: next.has_notes,
              updated_at: next.updated_at,
            }
          : e
      )
    );
  }, []);

  const closeJournal = useCallback(() => setJournalBook(null), []);

  function selectStatus(value: StatusFilter) {
    setActiveStatus(value);
    setLingering(new Set());
  }

  function selectShelf(name: string | null) {
    setActiveShelf(name);
    setLingering(new Set());
  }

  /* ----------------------------- Derived views ----------------------------- */

  const shelfNames = useMemo(() => uniqueShelves(entries), [entries]);
  const shelf = activeShelf && shelfNames.some((s) => sameShelf(s, activeShelf)) ? activeShelf : null;

  const { tabCounts, shelfCounts, visible } = useMemo(() => {
    const matchesShelf = (e: GrimoireListEntry) => shelf === null || sameShelf(e.custom_shelf, shelf);
    const matchesStatus = (e: GrimoireListEntry) =>
      activeStatus === "all" || e.status === activeStatus;

    const tabCounts: Record<StatusFilter, number> = {
      all: 0,
      want_to_read: 0,
      currently_reading: 0,
      finished: 0,
    };
    const shelfCounts = new Map<string, number>();

    for (const e of entries) {
      if (matchesShelf(e)) {
        tabCounts.all += 1;
        tabCounts[e.status] += 1;
      }
      if (matchesStatus(e) && e.custom_shelf) {
        const key = e.custom_shelf.toLowerCase();
        shelfCounts.set(key, (shelfCounts.get(key) ?? 0) + 1);
      }
    }

    const visible = entries.filter(
      (e) => (matchesShelf(e) && matchesStatus(e)) || lingering.has(e.book_id)
    );

    return { tabCounts, shelfCounts, visible };
  }, [entries, activeStatus, shelf, lingering]);

  /* --------------------------------- Render -------------------------------- */

  return (
    <div className="relative min-h-screen text-[#D4C5B9]">
      <div aria-hidden className="fixed inset-0 z-[-1]">
        <Image
          src="/hero-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#130D08]/90 via-[#130D08]/80 to-[#130D08]/95 backdrop-blur-sm" />
      </div>

      <Header />

      {loading ? (
        <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
          <div className="flex items-center gap-3 text-amber-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="font-serif text-lg text-[#D4C5B9]">Consulting the archive...</span>
          </div>
        </main>
      ) : !userLoggedIn ? (
        <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
          <div
            data-glow
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-900/30 shadow-2xl shadow-black/40"
          >
            <Image
              src="/hero-bg.jpg"
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 448px) 448px, 100vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-black/80 backdrop-blur-md" />

            <div className="relative p-10 text-center">
              <div className="mb-5 text-5xl" aria-hidden="true">📜</div>
              <Manifest
                as="h1"
                by="word"
                className="mb-3 font-serif text-3xl font-bold tracking-wide text-[#FDFBF7]"
              >
                Log in to unlock your Grimoire
              </Manifest>
              <Manifest as="p" delay={0.5} className="mb-8 text-[#D4C5B9]">
                Sign in to bind your favorite tomes into a personal collection.
              </Manifest>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-8 py-3 font-semibold text-[#130D08] shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Log in
              </Link>
            </div>
          </div>
        </main>
      ) : entries.length === 0 ? (
        <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
          <div
            data-glow
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-900/30 shadow-2xl shadow-black/40"
          >
            <Image
              src="/hero-bg.jpg"
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 512px) 512px, 100vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-black/80 backdrop-blur-md" />

            <div className="relative p-10 text-center">
              <div className="mb-5 text-5xl" aria-hidden="true">🕯️</div>
              <Manifest
                as="h1"
                by="word"
                className="mb-3 font-serif text-3xl font-bold tracking-wide text-[#FDFBF7]"
              >
                Your shelves are currently bare...
              </Manifest>
              <Manifest as="p" delay={0.6} className="mb-8 text-[#D4C5B9]">
                Your Grimoire awaits its first tome. Wander the library, and bind the stories that call to you.
              </Manifest>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-8 py-3 font-semibold text-[#130D08] shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                Discover Tomes
              </Link>
            </div>
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-8 text-center md:text-left">
            <Manifest
              as="h1"
              by="word"
              className="font-serif text-4xl font-bold tracking-wide text-[#FDFBF7]"
            >
              My Grimoire
            </Manifest>
            <Manifest as="p" delay={0.35} className="mt-2 text-[#D4C5B9]">
              {entries.length} {entries.length === 1 ? "tome" : "tomes"} bound to your collection
            </Manifest>
          </header>

          {/* Status tabs */}
          <div
            role="tablist"
            aria-label="Filter by reading status"
            className="flex gap-1 overflow-x-auto border-b border-amber-900/30"
          >
            {TABS.map((tab) => {
              const active = activeStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  id={`grimoire-tab-${tab.value}`}
                  aria-selected={active}
                  aria-controls="grimoire-panel"
                  onClick={() => selectStatus(tab.value)}
                  className={`relative shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                    active ? "text-[#FDFBF7]" : "text-[#D4C5B9] hover:text-amber-400"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                      active ? "bg-amber-500/20 text-amber-300" : "bg-amber-500/10 text-[#D4C5B9]/80"
                    }`}
                  >
                    {tabCounts[tab.value]}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="grimoire-tab-underline"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom shelf pills */}
          {shelfNames.length > 0 && (
            <div
              role="group"
              aria-label="Filter by shelf"
              className="mt-4 flex flex-wrap items-center gap-2"
            >
              <span className="text-xs text-[#D4C5B9]/70">Shelves:</span>
              <button
                type="button"
                aria-pressed={shelf === null}
                onClick={() => selectShelf(null)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  shelf === null
                    ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
                    : "border-amber-900/40 bg-[#1C130D]/70 text-[#D4C5B9] hover:border-amber-500/60 hover:text-[#FDFBF7]"
                }`}
              >
                All shelves
              </button>
              {shelfNames.map((name) => {
                const active = sameShelf(shelf, name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectShelf(active ? null : name)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
                        : "border-amber-900/40 bg-[#1C130D]/70 text-[#D4C5B9] hover:border-amber-500/60 hover:text-[#FDFBF7]"
                    }`}
                  >
                    <Tag className="h-3 w-3" aria-hidden />
                    {name}
                    <span className="tabular-nums text-[#D4C5B9]/70">
                      {shelfCounts.get(name.toLowerCase()) ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Grid */}
          <div
            id="grimoire-panel"
            role="tabpanel"
            aria-labelledby={`grimoire-tab-${activeStatus}`}
            className="mt-8"
          >
            {visible.length === 0 ? (
              <div className="mx-auto max-w-md rounded-2xl border border-amber-900/30 bg-[#1C130D]/75 p-10 text-center backdrop-blur-md">
                <h2 className="font-serif text-xl font-semibold text-[#FDFBF7]">
                  Nothing rests here yet
                </h2>
                <p className="mt-2 text-sm">
                  No tomes match this shelf and status. Try a different filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    selectStatus("all");
                    selectShelf(null);
                  }}
                  className="mt-5 rounded-lg border border-amber-900/40 px-4 py-2 text-sm font-semibold text-[#FDFBF7] transition-colors hover:bg-amber-500/10"
                >
                  Show everything
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
                {visible.map((entry, index) => {
                  const ref = toRef(entry);
                  return (
                    <TiltBookCard
                      key={entry.id}
                      book={{
                        id: entry.book_id,
                        title: entry.book_title,
                        author: entry.book_author ?? "Unknown author",
                        cover: entry.book_cover,
                      }}
                      index={index}
                      href={`/book/${encodeURIComponent(entry.book_id)}`}
                      topLeft={
                        entry.has_notes ? (
                          <NotesIndicator
                            title={entry.book_title}
                            onClick={() => setJournalBook(ref)}
                          />
                        ) : undefined
                      }
                      topRight={
                        <ShelfSelector
                          variant="compact"
                          book={ref}
                          entry={entry}
                          shelves={shelfNames}
                          onChange={(next) => handleEntryChange(entry.book_id, next)}
                        />
                      }
                      footer={<CardMeta entry={entry} onOpenJournal={() => setJournalBook(ref)} />}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        </main>
      )}

      <BookJournalDrawer
        book={journalBook}
        onClose={closeJournal}
        onSaved={(entry) => handleEntryChange(entry.book_id, entry)}
      />
    </div>
  );
}