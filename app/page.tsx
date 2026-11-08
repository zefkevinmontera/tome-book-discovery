"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  BookmarkCheck,
  BookmarkPlus,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Star,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import Header from "@/app/components/Header";
import FavoriteButton from "@/app/components/FavoriteButton";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface VolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  language?: string;
  imageLinks?: { smallThumbnail?: string; thumbnail?: string };
  infoLink?: string;
  previewLink?: string;
}

interface Volume {
  id: string;
  volumeInfo: VolumeInfo;
}

interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  cover: string | null;
  description: string;
  publishedDate?: string;
  pageCount?: number;
  publisher?: string;
  categories: string[];
  rating?: number;
  ratingsCount?: number;
  link?: string;
}

type Status = "loading" | "success" | "error";

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

const API_URL = "https://www.googleapis.com/books/v1/volumes";
const FIELDS =
  "items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,pageCount,categories,averageRating,ratingsCount,language,imageLinks,infoLink,previewLink))";
const DEFAULT_QUERY = "subject:fiction";

const SUGGESTIONS = [
  "Cozy mystery in a rainy seaside town",
  "Space opera with found family",
  "Quiet novels about grief and healing",
  "Dark academia campus thriller",
];

const GLASS = "border border-amber-900/30 bg-[#1C130D]/75 backdrop-blur-md";

const GRID_CLASSES =
  "grid grid-flow-dense auto-rows-[200px] grid-cols-2 gap-3 sm:auto-rows-[240px] md:grid-cols-4";

function spanClass(index: number): string {
  if (index % 9 === 0) return "col-span-2 row-span-2";
  if (index % 9 === 5) return "md:col-span-2";
  return "";
}

function normalize(volume: Volume): Book | null {
  const info = volume.volumeInfo;
  if (!info?.title) return null;

  const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail;
  const cover = rawCover
    ? rawCover.replace("http://", "https://").replace("&edge=curl", "")
    : null;

  return {
    id: volume.id,
    title: info.title,
    subtitle: info.subtitle,
    authors: info.authors ?? [],
    cover,
    description: info.description ?? "",
    publishedDate: info.publishedDate,
    pageCount: info.pageCount,
    publisher: info.publisher,
    categories: info.categories ?? [],
    rating: info.averageRating,
    ratingsCount: info.ratingsCount,
    link: info.infoLink ?? info.previewLink,
  };
}

function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function formatDate(date?: string): string {
  if (!date) return "Not recorded";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (/^\d{4}-\d{2}$/.test(date)) {
    return new Date(`${date}-01T00:00:00`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  }
  return date;
}

/* -------------------------------------------------------------------------- */
/*                          Data fetching (client-side)                       */
/* -------------------------------------------------------------------------- */

function useBookSearch(query: string) {
  const [books, setBooks] = useState<Book[]>([]);
  const [savedBookIds, setSavedBookIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
        const url = `${API_URL}?q=${encodeURIComponent(query)}&maxResults=20&printType=books&fields=${encodeURIComponent(FIELDS)}${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ""}`;

        const [res, authRes] = await Promise.all([
          fetch(url, { signal: controller.signal }),
          supabase.auth.getUser(),
        ]);

        if (!res.ok) throw new Error(`Google Books responded with ${res.status}`);

        const data: { items?: Volume[] } = await res.json();
        const seen = new Set<string>();
        const next = (data.items ?? [])
          .map(normalize)
          .filter((book): book is Book => {
            if (!book || seen.has(book.id)) return false;
            seen.add(book.id);
            return true;
          });

        if (authRes.data.user) {
          const { data: favorites } = await supabase
            .from("favorites")
            .select("book_id")
            .eq("user_id", authRes.data.user.id);

          setSavedBookIds(new Set((favorites ?? []).map((f) => f.book_id)));
        } else {
          setSavedBookIds(new Set());
        }

        setBooks(next);
        setStatus("success");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setBooks([]);
        setStatus("error");
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, nonce]);

  return { books, savedBookIds, setSavedBookIds, status, retry: () => setNonce((n) => n + 1) };
}

/* -------------------------------------------------------------------------- */
/*                                 Components                                 */
/* -------------------------------------------------------------------------- */

interface VibeSearchProps {
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

function VibeSearch({ value, onChange, loading, inputRef }: VibeSearchProps) {
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setShortcut("⌘K");
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        className={`${GLASS} flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-[0_20px_60px_-20px_rgba(245,158,11,0.3)] transition-[border-color,box-shadow] focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-500/40 focus-within:shadow-[0_20px_60px_-15px_rgba(245,158,11,0.5)]`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" aria-hidden />
        ) : (
          <Sparkles className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Whisper a setting or vibe..."
          aria-label="Consult the Grimoire"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-[#FDFBF7] outline-none placeholder:text-[#D4C5B9]/55 focus-visible:outline-none"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="rounded-md p-1 text-[#D4C5B9]/70 transition-colors hover:bg-amber-500/10 hover:text-[#FDFBF7]"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-amber-900/40 bg-black/30 px-1.5 py-0.5 font-sans text-[11px] text-[#D4C5B9] sm:block">
            {shortcut}
          </kbd>
        )}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center justify-center gap-2"
        role="group"
        aria-label="Suggested incantations"
      >
        <span className="text-xs text-[#D4C5B9]/70">Try an incantation:</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              onChange(suggestion);
              inputRef.current?.focus();
            }}
            className="rounded-full border border-amber-900/40 bg-[#1C130D]/70 px-3 py-1 text-xs text-[#D4C5B9] backdrop-blur-md transition-colors hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-[#FDFBF7]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className={GRID_CLASSES} aria-busy="true" aria-label="Summoning tomes">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className={`${GLASS} relative overflow-hidden rounded-2xl ${spanClass(i)}`}
        >
          <div className="skeleton absolute bottom-[76px] left-1/2 top-4 w-[44%] max-w-[140px] -translate-x-1/2 rounded-md" />
          <div className="absolute inset-x-4 bottom-4 space-y-2">
            <div className="skeleton h-3 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface BookCardProps {
  book: Book;
  index: number;
  selected: boolean;
  isFavorited: boolean;
  onSelect: (book: Book) => void;
  onFavoriteToggle: (bookId: string, isSaved: boolean) => void;
}

// Placeholder vibe tags. Swap for real data once you have it.
const VIBE_PLACEHOLDERS: [string, string][] = [
  ["#cozy", "#mystery"],
  ["#atmospheric", "#slow-burn"],
  ["#whimsical", "#found-family"],
  ["#dark-academia", "#haunting"],
];

function BookCard({ book, index, selected, isFavorited, onSelect, onFavoriteToggle }: BookCardProps) {
  const featured = index % 9 === 0;
  const authors = book.authors.join(", ") || "Author unknown";
  const vibeTags = VIBE_PLACEHOLDERS[index % VIBE_PLACEHOLDERS.length];

  return (
    <motion.div
      onClick={() => onSelect(book)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(book);
        }
      }}
      aria-pressed={selected}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.3) }}
      whileHover={{ y: -4, transition: { duration: 0.3, delay: 0 } }}
      whileTap={{ scale: 0.99 }}
      className={`${GLASS} group relative overflow-hidden rounded-2xl text-left cursor-pointer transition-[border-color,box-shadow] duration-300 ${
        selected
          ? "border-amber-500 ring-1 ring-amber-500/60 shadow-[0_0_30px_-8px_rgba(245,158,11,0.6)]"
          : "hover:border-amber-600/60 hover:shadow-[0_0_15px_rgba(218,165,32,0.3)]"
      } ${spanClass(index)}`}
    >
      <div className="absolute right-2.5 top-2.5 z-20">
        <FavoriteButton
          key={`${book.id}-${isFavorited}`}
          book={{
            id: book.id,
            title: book.title,
            author: authors,
            cover: book.cover,
          }}
          initialIsFavorited={isFavorited}
          onToggle={(isSaved) => onFavoriteToggle(book.id, isSaved)}
        />
      </div>

      {book.cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={book.cover}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-2xl"
          />
          <div className="absolute inset-x-0 bottom-[68px] top-0 flex items-center justify-center p-4 sm:bottom-[92px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={book.cover}
              alt={`Cover of ${book.title}`}
              loading="lazy"
              className="max-h-full rounded-md object-contain shadow-[0_8px_30px_rgba(0,0,0,0.7)] ring-1 ring-amber-900/40 transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        </>
      ) : (
        <div className="absolute inset-x-0 bottom-[68px] top-0 grid place-items-center sm:bottom-[92px]">
          <div className="grid h-24 w-16 place-items-center rounded-md border border-amber-900/40 bg-black/30">
            <BookOpen className="h-6 w-6 text-amber-700" aria-hidden />
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#130D08] via-[#130D08]/90 to-transparent px-4 pb-3.5 pt-8">
        <p
          className={`line-clamp-1 font-serif font-semibold text-[#FDFBF7] ${featured ? "text-lg" : "text-sm"}`}
        >
          {book.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-[#D4C5B9]">{authors}</p>

        <ul aria-label="Vibe tags" className="mt-2 hidden items-center gap-1.5 sm:flex">
          {vibeTags.map((tag) => (
            <li
              key={tag}
              className="whitespace-nowrap rounded-full border border-amber-700/30 px-2 py-0.5 text-xs leading-none text-amber-200/60"
            >
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-amber-900/30 py-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[#FDFBF7]">
        <Icon className="h-3.5 w-3.5 text-amber-600" aria-hidden />
        {label}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-[#D4C5B9]">{children}</div>
    </div>
  );
}

function DetailPanel({
  book,
  isFavorited,
  onClose,
  onFavoriteToggle,
}: {
  book: Book | null;
  isFavorited: boolean;
  onClose: () => void;
  onFavoriteToggle: (bookId: string, isSaved: boolean) => void;
}) {
  const authors = book?.authors.join(", ") || "Author unknown";
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<"login" | "failed" | null>(null);

  useEffect(() => {
    setBindError(null);
  }, [book?.id]);

  async function handleBind() {
    if (!book || binding) return;
    setBinding(true);
    setBindError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBindError("login");
        return;
      }

      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("book_id", book.id);
        if (error) throw error;
        onFavoriteToggle(book.id, false);
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          book_id: book.id,
          book_title: book.title,
          book_author: authors,
          book_cover: book.cover,
        });
        if (error) throw error;
        onFavoriteToggle(book.id, true);
      }
    } catch {
      setBindError("failed");
    } finally {
      setBinding(false);
    }
  }

  return (
    <AnimatePresence>
      {book && (
        <>
          <motion.button
            key="backdrop"
            type="button"
            aria-label="Close book details"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label={`Details for ${book.title}`}
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed inset-y-0 right-0 z-40 flex w-full flex-col overflow-hidden border-l border-amber-900/30 bg-[#1C130D]/95 shadow-2xl shadow-black/70 backdrop-blur-md sm:w-[400px] lg:bottom-4 lg:right-4 lg:top-[72px] lg:rounded-2xl lg:border"
          >
            <div className="flex items-center justify-between border-b border-amber-900/30 px-6 py-3">
              <span className="font-serif text-sm text-[#D4C5B9]">From the archive</span>
              <div className="flex items-center gap-2">
                <FavoriteButton
                  key={`${book.id}-${isFavorited}`}
                  book={{
                    id: book.id,
                    title: book.title,
                    author: authors,
                    cover: book.cover,
                  }}
                  initialIsFavorited={isFavorited}
                  onToggle={(isSaved) => onFavoriteToggle(book.id, isSaved)}
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close book details"
                  className="rounded-md p-1.5 text-[#D4C5B9]/80 transition-colors hover:bg-amber-500/10 hover:text-[#FDFBF7]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <motion.div
              key={book.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex-1 overflow-y-auto px-6 pb-6 pt-6"
            >
              {book.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.cover}
                  alt={`Cover of ${book.title}`}
                  className="h-36 w-auto rounded-xl bg-black/30 object-contain shadow-[0_8px_30px_rgba(0,0,0,0.6)] ring-1 ring-amber-900/40"
                />
              ) : (
                <div className="grid h-36 w-24 place-items-center rounded-xl border border-amber-900/40 bg-black/30">
                  <BookOpen className="h-7 w-7 text-amber-700" aria-hidden />
                </div>
              )}

              <h2 className="mt-5 font-serif text-2xl font-semibold leading-snug tracking-tight text-[#FDFBF7]">
                {book.title}
              </h2>
              {book.subtitle && (
                <p className="mt-1 text-sm italic text-[#D4C5B9]">{book.subtitle}</p>
              )}
              <p className="mt-2 text-sm text-[#D4C5B9]">{authors}</p>
              {book.link && (
                <a
                  href={book.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-amber-400 transition-colors hover:text-amber-300"
                >
                  books.google.com
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}

              <div className="mt-6">
                <MetaRow icon={CalendarDays} label="Released">
                  {formatDate(book.publishedDate)}
                </MetaRow>
                <MetaRow icon={FileText} label="Length">
                  {book.pageCount ? `${book.pageCount.toLocaleString()} pages` : "Not recorded"}
                </MetaRow>
                <MetaRow icon={FileText} label="Synopsis">
                  {book.description ? (
                    <p className="whitespace-pre-line">{toPlainText(book.description)}</p>
                  ) : (
                    <p>The archive holds no synopsis for this edition.</p>
                  )}
                </MetaRow>
                {book.publisher && (
                  <MetaRow icon={Building2} label="Publisher">
                    {book.publisher}
                  </MetaRow>
                )}
                {book.categories.length > 0 && (
                  <MetaRow icon={Tags} label="Genre">
                    <ul className="flex flex-wrap gap-1.5">
                      {book.categories.map((category) => (
                        <li
                          key={category}
                          className="rounded-full border border-[#4D7C5D]/50 bg-[#2D4A3E]/60 px-2.5 py-0.5 text-xs text-[#B7DCC4]"
                        >
                          {category}
                        </li>
                      ))}
                    </ul>
                  </MetaRow>
                )}
                {book.rating !== undefined && (
                  <MetaRow icon={Star} label="Rating">
                    {book.rating.toFixed(1)} / 5
                    {book.ratingsCount
                      ? ` from ${book.ratingsCount.toLocaleString()} readers`
                      : ""}
                  </MetaRow>
                )}
              </div>
            </motion.div>

            <div className="space-y-2.5 border-t border-amber-900/30 p-4">
              <button
                type="button"
                onClick={handleBind}
                disabled={binding}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-70 ${
                  isFavorited
                    ? "border border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                    : "bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-[0_0_20px_-6px_rgba(245,158,11,0.6)] hover:from-amber-500 hover:to-amber-600"
                }`}
              >
                {binding ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : isFavorited ? (
                  <BookmarkCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <BookmarkPlus className="h-4 w-4" aria-hidden />
                )}
                {binding
                  ? "Binding..."
                  : isFavorited
                    ? "Bound to your Grimoire"
                    : "Bind to Grimoire"}
              </button>

              {bindError && (
                <p role="alert" className="text-center text-xs text-red-300">
                  {bindError === "login" ? (
                    <>
                      <Link
                        href="/login"
                        className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
                      >
                        Log in
                      </Link>{" "}
                      to bind tomes to your Grimoire.
                    </>
                  ) : (
                    "The binding failed. Please try again."
                  )}
                </p>
              )}

              {book.link && (
                <a
                  href={book.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-900/40 bg-transparent px-4 py-2.5 text-sm font-semibold text-[#FDFBF7] transition-colors hover:bg-amber-500/10"
                >
                  Read the full tome
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-24 text-center">
      <div className={`${GLASS} grid h-11 w-11 place-items-center rounded-xl`}>
        <Search className="h-5 w-5 text-amber-400" aria-hidden />
      </div>
      <h3 className="mt-4 font-serif text-lg font-semibold text-[#FDFBF7]">
        The shelves are silent
      </h3>
      <p className="mt-1.5 text-sm text-[#D4C5B9]">
        No tome answered that whisper. Try naming a genre, a setting, or an era.
      </p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-24 text-center">
      <div className={`${GLASS} grid h-11 w-11 place-items-center rounded-xl`}>
        <AlertCircle className="h-5 w-5 text-amber-400" aria-hidden />
      </div>
      <h3 className="mt-4 font-serif text-lg font-semibold text-[#FDFBF7]">
        The archive is out of reach
      </h3>
      <p className="mt-1.5 text-sm text-[#D4C5B9]">
        Google Books didn&apos;t answer. Check your connection, then cast the spell again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-md bg-gradient-to-r from-amber-600 to-amber-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:from-amber-500 hover:to-amber-600"
      >
        Cast it again
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function DiscoverPage() {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<Book | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = input.trim();
  const { books, savedBookIds, setSavedBookIds, status, retry } = useBookSearch(
    trimmed || DEFAULT_QUERY
  );

  const handleFavoriteToggle = (bookId: string, isSaved: boolean) => {
    setSavedBookIds((prev) => {
      const next = new Set(prev);
      if (isSaved) {
        next.add(bookId);
      } else {
        next.delete(bookId);
      }
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const resultsLabel = trimmed
    ? `Tomes that answered “${trimmed}”`
    : "From the first shelf of the Grimoire";

  return (
    <MotionConfig reducedMotion="user">
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
          <div className="absolute inset-0 bg-gradient-to-b from-[#130D08]/85 via-[#130D08]/70 to-[#130D08]/95" />
        </div>

        <Header />

        <div
          className={`relative transition-[padding] duration-300 ${
            selected ? "lg:pr-[420px]" : ""
          }`}
        >
          <main className="mx-auto max-w-[1200px] px-6 pb-24 pt-16 sm:pt-20">
            <section className="text-center">
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-[#FDFBF7] [text-shadow:0_2px_24px_rgba(0,0,0,0.6)] sm:text-5xl">
                Unveil your next journey
              </h1>
              <p className="mx-auto mt-4 max-w-md text-[15px] text-[#D4C5B9]">
                Whisper a mood, a setting, or a half-remembered tale, and the library will
                answer.
              </p>
              <div className="mt-8">
                <VibeSearch
                  value={input}
                  onChange={setInput}
                  loading={status === "loading"}
                  inputRef={inputRef}
                />
              </div>
            </section>

            <section className="mt-14">
              <div className="mb-4 flex items-center justify-between border-b border-amber-900/30 pb-3">
                <h2
                  className="font-serif text-base font-semibold text-[#FDFBF7]"
                  aria-live="polite"
                >
                  {resultsLabel}
                </h2>
                {status === "success" && books.length > 0 && (
                  <span className="text-xs text-[#D4C5B9]/70">{books.length} tomes</span>
                )}
              </div>

              {status === "loading" && <SkeletonGrid />}
              {status === "error" && <ErrorState onRetry={retry} />}
              {status === "success" && books.length === 0 && <EmptyState />}
              {status === "success" && books.length > 0 && (
                <div className={GRID_CLASSES}>
                  {books.map((book, index) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      index={index}
                      selected={selected?.id === book.id}
                      isFavorited={savedBookIds.has(book.id)}
                      onSelect={setSelected}
                      onFavoriteToggle={handleFavoriteToggle}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>

        <DetailPanel
          book={selected}
          isFavorited={selected ? savedBookIds.has(selected.id) : false}
          onClose={() => setSelected(null)}
          onFavoriteToggle={handleFavoriteToggle}
        />
      </div>
    </MotionConfig>
  );
}