"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  BookmarkPlus,
  BookOpen,
  CheckCircle2,
  Loader2,
  Plus,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  AuthRequiredError,
  MAX_SHELF_LENGTH,
  STATUS_LABEL,
  STATUS_OPTIONS,
  normalizeShelfName,
  removeEntry,
  saveEntry,
  type BookRef,
  type GrimoireEntry,
  type ReadingStatus,
  type ShelfState,
} from "@/lib/grimoire";

export const STATUS_ICON: Record<ReadingStatus, LucideIcon> = {
  want_to_read: Bookmark,
  currently_reading: BookOpen,
  finished: CheckCircle2,
};

/* -------------------------------------------------------------------------- */
/*                         Shared controls (status + shelf)                    */
/* -------------------------------------------------------------------------- */

interface ShelfPanelProps {
  book: BookRef;
  entry: ShelfState | null;
  shelves: string[];
  onChange: (entry: GrimoireEntry | null) => void;
  onRemoved?: () => void;
}

function ShelfPanel({ book, entry, shelves, onChange, onRemoved }: ShelfPanelProps) {
  const uid = useId();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<"login" | "failed" | null>(null);
  const [newShelf, setNewShelf] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const busy = pending !== null;

  const allShelves =
    entry?.custom_shelf && !shelves.some((s) => s.toLowerCase() === entry.custom_shelf!.toLowerCase())
      ? [...shelves, entry.custom_shelf]
      : shelves;

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setPending(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof AuthRequiredError ? "login" : "failed");
    } finally {
      setPending(null);
    }
  }

  function chooseStatus(status: ReadingStatus) {
    if (entry?.status === status) return;
    void run(status, async () => {
      onChange(await saveEntry(createClient(), book, { status }));
    });
  }

  function toggleShelf(name: string) {
    const isActive = entry?.custom_shelf?.toLowerCase() === name.toLowerCase();
    void run(`shelf:${name}`, async () => {
      onChange(await saveEntry(createClient(), book, { custom_shelf: isActive ? null : name }));
    });
  }

  function addShelf(e: FormEvent) {
    e.preventDefault();
    const name = normalizeShelfName(newShelf, allShelves);
    if (!name) return;
    setNewShelf("");
    void run("new-shelf", async () => {
      onChange(await saveEntry(createClient(), book, { custom_shelf: name }));
    });
  }

  function remove() {
    if (entry?.has_notes && !confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    void run("remove", async () => {
      await removeEntry(createClient(), book.id);
      setConfirmRemove(false);
      onChange(null);
      onRemoved?.();
    });
  }

  return (
    <div className="space-y-5">
      {/* Reading status */}
      <section>
        <h3 id={`${uid}-status`} className="font-serif text-sm font-semibold text-[#FDFBF7]">
          Reading status
        </h3>
        <div
          role="group"
          aria-labelledby={`${uid}-status`}
          className="mt-2 grid grid-cols-3 gap-2"
        >
          {STATUS_OPTIONS.map((opt) => {
            const Icon = STATUS_ICON[opt.value];
            const active = entry?.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                disabled={busy}
                onClick={() => chooseStatus(opt.value)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                  active
                    ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
                    : "border-amber-900/40 bg-black/20 text-[#D4C5B9] hover:border-amber-600/60 hover:text-[#FDFBF7]"
                }`}
              >
                {pending === opt.value ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
                {opt.short}
              </button>
            );
          })}
        </div>
        {!entry && (
          <p className="mt-2 text-xs text-[#D4C5B9]/70">
            Choose a status to bind this tome to your Grimoire.
          </p>
        )}
      </section>

      {/* Custom shelf */}
      <section>
        <h3 className="font-serif text-sm font-semibold text-[#FDFBF7]">Shelf</h3>

        {allShelves.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Your shelves">
            {allShelves.map((name) => {
              const active = entry?.custom_shelf?.toLowerCase() === name.toLowerCase();
              return (
                <li key={name}>
                  <button
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => toggleShelf(name)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                      active
                        ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
                        : "border-amber-900/40 bg-black/20 text-[#D4C5B9] hover:border-amber-600/60 hover:text-[#FDFBF7]"
                    }`}
                  >
                    <Tag className="h-3 w-3" aria-hidden />
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={addShelf} className="mt-2 flex gap-2">
          <label htmlFor={`${uid}-new`} className="sr-only">
            New shelf name
          </label>
          <input
            id={`${uid}-new`}
            type="text"
            value={newShelf}
            maxLength={MAX_SHELF_LENGTH}
            onChange={(e) => setNewShelf(e.target.value)}
            placeholder="New shelf, e.g. Cozy Autumn"
            autoComplete="off"
            disabled={busy}
            className="h-9 min-w-0 flex-1 rounded-lg border border-amber-900/30 bg-black/20 px-3 text-sm text-[#FDFBF7] outline-none transition-[border-color,box-shadow] placeholder:text-[#D4C5B9]/45 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !newShelf.trim()}
            aria-label="Create shelf and place this tome on it"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 text-white transition-colors hover:from-amber-500 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === "new-shelf" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
          </button>
        </form>
      </section>

      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error === "login" ? (
            <>
              <Link
                href="/login"
                className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                Log in
              </Link>{" "}
              to shelve tomes in your Grimoire.
            </>
          ) : (
            "That didn't take. Please try again."
          )}
        </p>
      )}

      {/* Remove */}
      {entry && (
        <div className="border-t border-amber-900/30 pt-4">
          {confirmRemove ? (
            <div role="alert" className="space-y-2.5">
              <p className="text-xs text-red-300">
                Removing this tome also deletes your journal notes. This can&apos;t be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                >
                  {pending === "remove" ? "Removing..." : "Remove and delete notes"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={busy}
                  className="rounded-md border border-amber-900/40 px-3 py-1.5 text-xs font-semibold text-[#FDFBF7] transition-colors hover:bg-amber-500/10"
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-xs text-red-300/80 underline-offset-2 transition-colors hover:text-red-300 hover:underline disabled:opacity-60"
            >
              {pending === "remove" ? "Removing..." : "Remove from Grimoire"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Public component                              */
/* -------------------------------------------------------------------------- */

export interface ShelfSelectorProps {
  book: BookRef;
  /** Current state, or null when the book isn't in the Grimoire yet. */
  entry: ShelfState | null;
  /** The user's existing shelf names (for quick-pick chips). */
  shelves: string[];
  /** Called after every successful save (entry) or removal (null). */
  onChange: (entry: GrimoireEntry | null) => void;
  variant?: "full" | "compact";
  className?: string;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

export default function ShelfSelector({
  book,
  entry,
  shelves,
  onChange,
  variant = "full",
  className = "",
}: ShelfSelectorProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (variant === "full") {
    return (
      <section
        aria-label="Your shelf"
        className={`rounded-2xl border border-amber-900/30 bg-[#1C130D]/60 p-5 backdrop-blur-md ${className}`}
      >
        <ShelfPanel book={book} entry={entry} shelves={shelves} onChange={onChange} />
      </section>
    );
  }

  const Icon = entry ? STATUS_ICON[entry.status] : BookmarkPlus;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={stop}
        aria-haspopup="dialog"
        aria-label={
          entry
            ? `Change shelf for ${book.title}. Currently ${STATUS_LABEL[entry.status]}`
            : `Bind ${book.title} to your Grimoire`
        }
        className={`grid h-9 w-9 place-items-center rounded-full ring-1 backdrop-blur transition-colors ${
          entry
            ? "bg-amber-500/25 text-amber-300 ring-amber-500/60 hover:bg-amber-500/35"
            : "bg-black/55 text-[#FDFBF7] ring-amber-500/30 hover:bg-black/75 hover:ring-amber-500/60"
        } ${className}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="shelf-dialog"
                // React events bubble through portals, so keep clicks, keys and
                // pointer movement from reaching the card this trigger lives in.
                onClick={stop}
                onKeyDown={stop}
                onPointerMove={stop}
                onPointerDown={stop}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
              >
                <div
                  aria-hidden
                  onClick={close}
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                />
                <motion.div
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 24, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                  className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-amber-900/30 bg-[#1C130D]/95 p-5 shadow-2xl shadow-black/70 outline-none backdrop-blur-md"
                >
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        id={titleId}
                        className="font-serif text-lg font-semibold text-[#FDFBF7]"
                      >
                        Shelve this tome
                      </h2>
                      <p className="mt-0.5 line-clamp-1 text-sm text-[#D4C5B9]">{book.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Close"
                      className="rounded-md p-1.5 text-[#D4C5B9]/80 transition-colors hover:bg-amber-500/10 hover:text-[#FDFBF7]"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <ShelfPanel
                    book={book}
                    entry={entry}
                    shelves={shelves}
                    onChange={onChange}
                    onRemoved={close}
                  />

                  <button
                    type="button"
                    onClick={close}
                    className="mt-5 w-full rounded-lg border border-amber-900/40 px-4 py-2.5 text-sm font-semibold text-[#FDFBF7] transition-colors hover:bg-amber-500/10"
                  >
                    Done
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}