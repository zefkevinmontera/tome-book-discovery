import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Loader2,
  Star,
  Tags,
} from "lucide-react";
import Header from "@/app/components/Header";
import Manifest from "@/app/components/Manifest";
import GrimoireWidgets from "@/app/components/GrimoireWidgets";
import { createClient } from "@/lib/supabase/server";
import { cleanCoverUrl, formatDate, toPlainText } from "@/lib/books";
import {
  FULL_COLUMNS,
  uniqueShelves,
  type BookRef,
  type GrimoireEntry,
} from "@/lib/grimoire";

// Allow blocking route for runtime data (bypasses static shell prerendering for params)
export const instant = false;

/* -------------------------------------------------------------------------- */
/*                               Google Books data                            */
/* -------------------------------------------------------------------------- */

const API_URL = "https://www.googleapis.com/books/v1/volumes";
const FIELDS =
  "id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,pageCount,categories,averageRating,ratingsCount,language,imageLinks,infoLink,previewLink,canonicalVolumeLink)";

interface VolumeDetail {
  id: string;
  volumeInfo: {
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
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    infoLink?: string;
    previewLink?: string;
    canonicalVolumeLink?: string;
  };
}

type VolumeResult =
  | { status: "ok"; volume: VolumeDetail }
  | { status: "not_found" }
  | { status: "error" };

const getVolume = cache(async (id: string): Promise<VolumeResult> => {
  const key = process.env.GOOGLE_BOOKS_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
  const url = `${API_URL}/${encodeURIComponent(id)}?fields=${encodeURIComponent(FIELDS)}${
    key ? `&key=${encodeURIComponent(key)}` : ""
  }`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "error" };
    return { status: "ok", volume: (await res.json()) as VolumeDetail };
  } catch {
    return { status: "error" };
  }
});

/* -------------------------------------------------------------------------- */
/*                           Dynamic User Data Component                       */
/* -------------------------------------------------------------------------- */

const GLASS = "border border-amber-900/30 bg-[#1C130D]/75 backdrop-blur-md";
const GOLD_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(245,158,11,0.6)] transition-colors hover:from-amber-500 hover:to-amber-600";
const OUTLINE_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-amber-900/40 bg-transparent px-5 py-2.5 text-sm font-semibold text-[#FDFBF7] transition-colors hover:bg-amber-500/10";

async function GrimoireSection({ bookRef }: { bookRef: BookRef }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className={`${GLASS} rounded-2xl p-6 text-center`}>
        <p className="font-serif text-lg text-[#FDFBF7]">Bind this tome to your Grimoire</p>
        <p className="mx-auto mt-1.5 max-w-md text-sm">
          Log in to set a reading status, arrange shelves, and keep private notes.
        </p>
        <Link href="/login" className={`${GOLD_BUTTON} mt-5`}>
          Log in
        </Link>
      </div>
    );
  }

  const [entryRes, shelfRes] = await Promise.all([
    supabase
      .from("grimoire_entries")
      .select(FULL_COLUMNS)
      .eq("user_id", user.id)
      .eq("book_id", bookRef.id)
      .maybeSingle(),
    supabase
      .from("grimoire_entries")
      .select("custom_shelf")
      .eq("user_id", user.id)
      .not("custom_shelf", "is", null),
  ]);

  const entry = (entryRes.data ?? null) as unknown as GrimoireEntry | null;
  const shelves = uniqueShelves((shelfRes.data ?? []) as { custom_shelf: string | null }[]);

  return <GrimoireWidgets book={bookRef} initialEntry={entry} initialShelves={shelves} />;
}

/* -------------------------------------------------------------------------- */
/*                                  Metadata                                  */
/* -------------------------------------------------------------------------- */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getVolume(id);
  if (result.status !== "ok") return { title: "Tome not found | Tome" };

  const info = result.volume.volumeInfo;
  const description = info.description ? toPlainText(info.description).slice(0, 160) : undefined;
  return {
    title: `${info.title ?? "Untitled"} | Tome`,
    description,
  };
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

function https(url?: string): string | undefined {
  return url?.replace("http://", "https://");
}

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getVolume(id);

  if (result.status === "not_found") notFound();

  const background = (
    <div aria-hidden className="fixed inset-0 z-[-1]">
      <Image src="/hero-bg.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#130D08]/90 via-[#130D08]/80 to-[#130D08]/95 backdrop-blur-sm" />
    </div>
  );

  if (result.status === "error") {
    return (
      <div className="relative min-h-screen text-[#D4C5B9]">
        {background}
        <Header />
        <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
          <div className={`${GLASS} w-full max-w-md rounded-2xl p-10 text-center`}>
            <h1 className="mb-3 font-serif text-2xl font-bold text-[#FDFBF7]">
              The archive is out of reach
            </h1>
            <p className="mb-6 text-[#D4C5B9]">
              Google Books didn&apos;t answer. Give it a moment, then cast the spell again.
            </p>
            <Link href={`/book/${encodeURIComponent(id)}`} className={GOLD_BUTTON}>
              Try again
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const { volume } = result;
  const info = volume.volumeInfo;
  const title = info.title ?? "Untitled";
  const authors = info.authors ?? [];
  const links = info.imageLinks ?? {};

  const largeCover = cleanCoverUrl(
    links.extraLarge ?? links.large ?? links.medium ?? links.small ?? links.thumbnail
  );
  const storedCover = cleanCoverUrl(links.thumbnail ?? links.smallThumbnail);

  const bookRef: BookRef = {
    id: volume.id,
    title,
    author: authors.join(", ") || null,
    cover: storedCover,
  };

  const genres = [
    ...new Set((info.categories ?? []).flatMap((c) => c.split("/").map((s) => s.trim()))),
  ].filter(Boolean);

  const description = info.description ? toPlainText(info.description) : "";
  const previewLink = https(info.previewLink);
  const infoLink = https(info.infoLink ?? info.canonicalVolumeLink);

  return (
    <div className="relative min-h-screen text-[#D4C5B9]">
      {background}
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#D4C5B9] transition-colors hover:text-amber-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to the library
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[300px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="relative mx-auto aspect-[2/3] w-full max-w-[300px] overflow-hidden rounded-xl bg-[#130D08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-amber-900/40">
              {largeCover ? (
                <Image
                  src={largeCover}
                  alt={`Cover of ${title}`}
                  fill
                  priority
                  sizes="(min-width: 1024px) 300px, 70vw"
                  className="object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <BookOpen className="h-10 w-10 text-amber-700" aria-hidden />
                </div>
              )}
            </div>

            {(previewLink || infoLink) && (
              <div className="mx-auto mt-5 flex max-w-[300px] flex-col gap-2.5">
                {previewLink && (
                  <a href={previewLink} target="_blank" rel="noopener noreferrer" className={GOLD_BUTTON}>
                    Preview on Google Books
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                )}
                {infoLink && (
                  <a href={infoLink} target="_blank" rel="noopener noreferrer" className={OUTLINE_BUTTON}>
                    View on Google Books
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                )}
              </div>
            )}
          </aside>

          <article className="min-w-0 space-y-8">
            <header>
              <Manifest
                as="h1"
                by="word"
                className="font-serif text-4xl font-bold leading-tight tracking-wide text-[#FDFBF7] sm:text-5xl"
              >
                {title}
              </Manifest>
              {info.subtitle && (
                <Manifest as="p" delay={0.3} className="mt-2 font-serif text-xl italic text-[#D4C5B9]">
                  {info.subtitle}
                </Manifest>
              )}
              <Manifest as="p" delay={0.45} className="mt-3 text-base text-[#D4C5B9]">
                {authors.length > 0 ? `by ${authors.join(", ")}` : "Author unknown"}
              </Manifest>

              <ul className="mt-5 flex flex-wrap gap-2 text-sm">
                {info.averageRating !== undefined && (
                  <li className="inline-flex items-center gap-1.5 rounded-full border border-amber-900/40 bg-[#1C130D]/70 px-3 py-1">
                    <Star className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                    {info.averageRating.toFixed(1)} / 5
                    {info.ratingsCount ? ` (${info.ratingsCount.toLocaleString()})` : ""}
                  </li>
                )}
                {info.pageCount ? (
                  <li className="inline-flex items-center gap-1.5 rounded-full border border-amber-900/40 bg-[#1C130D]/70 px-3 py-1">
                    <FileText className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    {info.pageCount.toLocaleString()} pages
                  </li>
                ) : null}
                {info.publishedDate && (
                  <li className="inline-flex items-center gap-1.5 rounded-full border border-amber-900/40 bg-[#1C130D]/70 px-3 py-1">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    {formatDate(info.publishedDate)}
                  </li>
                )}
              </ul>
            </header>

            <section aria-labelledby="your-shelf">
              <h2 id="your-shelf" className="mb-3 font-serif text-xl font-semibold text-[#FDFBF7]">
                Your Grimoire
              </h2>
              <Suspense
                fallback={
                  <div className={`${GLASS} flex items-center justify-center gap-2 rounded-2xl p-6 text-sm text-[#D4C5B9]`}>
                    <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                    Consulting your Grimoire...
                  </div>
                }
              >
                <GrimoireSection bookRef={bookRef} />
              </Suspense>
            </section>

            <section aria-labelledby="synopsis" className={`${GLASS} rounded-2xl p-6`}>
              <h2 id="synopsis" className="mb-3 font-serif text-xl font-semibold text-[#FDFBF7]">
                Synopsis
              </h2>
              {description ? (
                <p className="whitespace-pre-line leading-relaxed">{description}</p>
              ) : (
                <p>The archive holds no synopsis for this edition.</p>
              )}
            </section>

            <section aria-labelledby="details" className={`${GLASS} rounded-2xl p-6`}>
              <h2 id="details" className="mb-4 font-serif text-xl font-semibold text-[#FDFBF7]">
                Details
              </h2>
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-[#FDFBF7]">
                    <Building2 className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    Publisher
                  </dt>
                  <dd className="mt-1 text-sm">{info.publisher ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-[#FDFBF7]">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    Released
                  </dt>
                  <dd className="mt-1 text-sm">{formatDate(info.publishedDate)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-[#FDFBF7]">
                    <FileText className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    Length
                  </dt>
                  <dd className="mt-1 text-sm">
                    {info.pageCount ? `${info.pageCount.toLocaleString()} pages` : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-2 text-sm font-medium text-[#FDFBF7]">
                    <BookOpen className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    Language
                  </dt>
                  <dd className="mt-1 text-sm uppercase">{info.language ?? "n/a"}</dd>
                </div>
              </dl>

              {genres.length > 0 && (
                <div className="mt-5 border-t border-amber-900/30 pt-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-[#FDFBF7]">
                    <Tags className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                    Genres
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {genres.map((genre) => (
                      <li
                        key={genre}
                        className="rounded-full border border-[#4D7C5D]/50 bg-[#2D4A3E]/60 px-2.5 py-0.5 text-xs text-[#B7DCC4]"
                      >
                        {genre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </article>
        </div>
      </main>
    </div>
  );
}