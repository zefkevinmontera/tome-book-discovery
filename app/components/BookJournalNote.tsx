"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, NotebookPen, Pencil, Quote, ScrollText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  AuthRequiredError,
  MAX_NOTES_LENGTH,
  saveEntry,
  type BookRef,
  type GrimoireEntry,
} from "@/lib/grimoire";

/* -------------------------------------------------------------------------- */
/*                          Read-mode rendering of notes                       */
/* -------------------------------------------------------------------------- */

/** Lines starting with "> " become pull-quotes; everything else is prose. */
function NoteBody({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let quote: string[] = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(
      <p key={out.length} className="whitespace-pre-line">
        {para.join("\n")}
      </p>
    );
    para = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    out.push(
      <blockquote
        key={out.length}
        className="whitespace-pre-line border-l-2 border-amber-800/60 pl-4 italic text-[#4a2c14]"
      >
        {quote.join("\n")}
      </blockquote>
    );
    quote = [];
  };

  for (const line of text.split("\n")) {
    if (line.startsWith("> ") || line === ">") {
      flushPara();
      quote.push(line.replace(/^>\s?/, ""));
    } else if (line.trim() === "") {
      flushPara();
      flushQuote();
    } else {
      flushQuote();
      para.push(line);
    }
  }
  flushPara();
  flushQuote();

  return <div className="space-y-3 font-serif text-[17px] leading-7">{out}</div>;
}

/* -------------------------------------------------------------------------- */
/*                                   Editor                                    */
/* -------------------------------------------------------------------------- */

type SaveStatus = "idle" | "saving" | "saved" | "login" | "failed";

export interface BookJournalNoteProps {
  book: BookRef;
  /** Known notes (null = none). Omit to have the component fetch them. */
  initialNotes?: string | null;
  /** Called with the saved entry after every successful save. */
  onSaved?: (entry: GrimoireEntry) => void;
  /** Lets a parent warn before discarding unsaved text. */
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
}

export default function BookJournalNote({
  book,
  initialNotes,
  onSaved,
  onDirtyChange,
  className = "",
}: BookJournalNoteProps) {
  const needsFetch = initialNotes === undefined;
  const [loading, setLoading] = useState(needsFetch);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [saved, setSaved] = useState(initialNotes ?? "");
  const [draft, setDraft] = useState(initialNotes ?? "");
  const [mode, setMode] = useState<"read" | "edit">(initialNotes ? "read" : "edit");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastProp = useRef(initialNotes);

  const dirty = draft !== saved;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Lazy-load notes when the parent doesn't have them.
  useEffect(() => {
    if (!needsFetch) return;
    let active = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      const { data, error } = await createClient()
        .from("grimoire_entries")
        .select("notes")
        .eq("book_id", book.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setLoadError(true);
      } else {
        const text = (data as { notes: string | null } | null)?.notes ?? "";
        setSaved(text);
        setDraft(text);
        setMode(text ? "read" : "edit");
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [needsFetch, book.id, reloadKey]);

  // Follow the parent when it passes new notes (e.g. after the book is removed),
  // but never overwrite text the reader is in the middle of writing.
  useEffect(() => {
    if (initialNotes === undefined || lastProp.current === initialNotes) return;
    lastProp.current = initialNotes;
    const next = initialNotes ?? "";
    if (draft === saved) {
      setDraft(next);
      setMode(next ? "read" : "edit");
    }
    setSaved(next);
  }, [initialNotes, draft, saved]);

  const handleSave = useCallback(async () => {
    if (!dirty || status === "saving") return;
    const text = draft.trim() === "" ? null : draft.replace(/\s+$/, "");

    // Nothing stored and nothing written: don't create an entry for blank text.
    if (text === null && saved === "") {
      setDraft("");
      return;
    }

    setStatus("saving");
    try {
      const entry = await saveEntry(createClient(), book, { notes: text });
      const next = entry.notes ?? "";
      setSaved(next);
      setDraft(next);
      setMode(next ? "read" : "edit");
      setStatus("saved");
      onSaved?.(entry);
    } catch (err) {
      setStatus(err instanceof AuthRequiredError ? "login" : "failed");
    }
  }, [book, dirty, draft, onSaved, saved, status]);

  function insertQuote() {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    const insertion = selected
      ? selected
          .split("\n")
          .map((l) => (l.startsWith("> ") ? l : `> ${l}`))
          .join("\n")
      : "> ";
    const before = value.slice(0, start);
    const lead = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    const next = (before + lead + insertion + value.slice(end)).slice(0, MAX_NOTES_LENGTH);
    setDraft(next);
    setStatus("idle");
    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(before.length + lead.length + insertion.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void handleSave();
    }
  }

  const shell = `relative flex flex-col overflow-hidden rounded-2xl border border-amber-900/50 bg-gradient-to-b from-[#EBDDBB] via-[#E3D2AB] to-[#D8C397] text-[#2B1A0E] shadow-[inset_0_0_70px_rgba(120,53,15,0.3),0_24px_60px_-24px_rgba(0,0,0,0.85)] ${className}`;

  return (
    <section aria-label={`Journal for ${book.title}`} className={shell}>
      {/* Faint ink stains for an aged feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 14%, #5b3a1a 0, transparent 38%), radial-gradient(circle at 84% 88%, #5b3a1a 0, transparent 44%)",
        }}
      />

      <div className="relative flex items-start justify-between gap-3 border-b border-amber-900/25 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-serif text-lg font-semibold italic text-[#3a2210]">
            <ScrollText className="h-4 w-4 shrink-0 text-amber-900" aria-hidden />
            Journal
          </p>
          <p className="mt-0.5 line-clamp-1 text-sm text-[#6b4a2b]">{book.title}</p>
        </div>
        {mode === "read" && !loading && (
          <button
            type="button"
            onClick={() => {
              setMode("edit");
              setStatus("idle");
              requestAnimationFrame(() => textareaRef.current?.focus());
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-900/40 px-2.5 py-1 text-xs font-semibold text-[#3a2210] transition-colors hover:bg-amber-900/10"
          >
            <Pencil className="h-3 w-3" aria-hidden />
            Edit
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm italic text-[#6b4a2b]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Unrolling the scroll...
          </div>
        ) : loadError ? (
          <div role="alert" className="space-y-3 px-5 py-8 text-sm text-[#6b2d1a]">
            <p>Your notes couldn&apos;t be loaded, so editing is paused to keep them safe.</p>
            <button
              type="button"
              onClick={() => setReloadKey((n) => n + 1)}
              className="rounded-md border border-amber-900/40 px-3 py-1.5 text-xs font-semibold text-[#3a2210] hover:bg-amber-900/10"
            >
              Try again
            </button>
          </div>
        ) : mode === "read" ? (
          <div className="px-5 py-5">
            <NoteBody text={saved} />
          </div>
        ) : (
          <div className="px-0 py-4 focus-within:bg-white/10">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value.slice(0, MAX_NOTES_LENGTH));
                if (status !== "idle") setStatus("idle");
              }}
              onKeyDown={handleKeyDown}
              rows={10}
              maxLength={MAX_NOTES_LENGTH}
              placeholder="Set down a thought, a favourite passage, a question for the margins..."
              aria-label={`Journal notes for ${book.title}`}
              className="block min-h-[14rem] w-full resize-y bg-transparent px-5 py-0 font-serif text-[17px] leading-[28px] text-[#2B1A0E] outline-none placeholder:text-[#6b4a2b]/55 focus:outline-none focus-visible:outline-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgba(120,53,15,0.22) 27px, rgba(120,53,15,0.22) 28px)",
                backgroundAttachment: "local",
              }}
            />
          </div>
        )}
      </div>

      {mode === "edit" && !loading && !loadError && (
        <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-amber-900/25 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={insertQuote}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-900/40 px-2.5 py-1 text-xs font-semibold text-[#3a2210] transition-colors hover:bg-amber-900/10"
            >
              <Quote className="h-3 w-3" aria-hidden />
              Add quote
            </button>
            <span className="text-xs tabular-nums text-[#6b4a2b]">
              {draft.length.toLocaleString()} / {MAX_NOTES_LENGTH.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-xs">
              {status === "saving" && <span className="text-[#6b4a2b]">Inscribing...</span>}
              {status === "saved" && (
                <span className="inline-flex items-center gap-1 text-[#2f5a3a]">
                  <Check className="h-3 w-3" aria-hidden />
                  Inscribed
                </span>
              )}
              {status === "failed" && (
                <span className="text-[#8a2a14]">Couldn&apos;t save. Try again.</span>
              )}
              {status === "login" && (
                <span className="text-[#8a2a14]">
                  <Link href="/login" className="font-semibold underline">
                    Log in
                  </Link>{" "}
                  to save notes.
                </span>
              )}
              {status === "idle" && dirty && <span className="text-[#6b4a2b]">Unsaved</span>}
            </span>

            {saved && (
              <button
                type="button"
                onClick={() => {
                  setDraft(saved);
                  setMode("read");
                  setStatus("idle");
                }}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-[#3a2210] transition-colors hover:bg-amber-900/10"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || status === "saving"}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-amber-700 to-amber-800 px-3.5 py-1.5 text-xs font-semibold text-[#FDFBF7] shadow-sm transition-colors hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "saving" ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <NotebookPen className="h-3 w-3" aria-hidden />
              )}
              Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                         Slide-over used by the Grimoire                     */
/* -------------------------------------------------------------------------- */

export function BookJournalDrawer({
  book,
  onClose,
  onSaved,
}: {
  book: BookRef | null;
  onClose: () => void;
  onSaved?: (entry: GrimoireEntry) => void;
}) {
  const dirtyRef = useRef(false);
  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Discard your unsaved notes?")) return;
    dirtyRef.current = false;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!book) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [book, requestClose]);

  const key = useMemo(() => book?.id ?? "none", [book]);

  return (
    <AnimatePresence>
      {book && (
        <>
          <motion.button
            key="journal-backdrop"
            type="button"
            aria-label="Close journal"
            onClick={requestClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            key="journal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Journal for ${book.title}`}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed inset-y-0 right-0 z-[91] flex w-full flex-col gap-3 border-l border-amber-900/30 bg-[#130D08]/95 p-4 shadow-2xl shadow-black/70 backdrop-blur-md sm:w-[480px]"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm text-[#D4C5B9]">From your Grimoire</span>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close journal"
                className="rounded-md p-1.5 text-[#D4C5B9]/80 transition-colors hover:bg-amber-500/10 hover:text-[#FDFBF7]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <BookJournalNote
              key={key}
              book={book}
              onSaved={onSaved}
              onDirtyChange={setDirty}
              className="min-h-0 flex-1"
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}