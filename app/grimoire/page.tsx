"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import FavoriteButton from "@/app/components/FavoriteButton";

type FavoriteRow = {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string | null;
  book_cover: string | null;
  created_at: string;
};

export default function GrimoirePage() {
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLoggedIn, setUserLoggedIn] = useState(false);

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
        .from("favorites")
        .select("id, book_id, book_title, book_author, book_cover, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setFavorites(data as FavoriteRow[]);
      }
      setLoading(false);
    }

    loadGrimoire();
  }, []);

  const handleRemoveFavorite = (bookId: string) => {
    setFavorites((prev) => prev.filter((item) => item.book_id !== bookId));
  };

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="flex items-center gap-3 text-amber-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="font-serif text-lg text-[#D4C5B9]">Consulting the archive...</span>
        </div>
      </main>
    );
  }

  if (!userLoggedIn) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-amber-900/30 bg-[#1C130D]/75 p-10 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="mb-5 text-5xl" aria-hidden="true">📜</div>
          <h1 className="mb-3 font-serif text-3xl font-bold tracking-wide text-[#FDFBF7]">
            Log in to unlock your Grimoire
          </h1>
          <p className="mb-8 text-[#D4C5B9]">
            Sign in to bind your favorite tomes into a personal collection.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-8 py-3 font-semibold text-[#130D08] shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-amber-400"
          >
            Log in
          </Link>
        </div>
      </main>
    );
  }

  if (favorites.length === 0) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg rounded-2xl border border-amber-900/30 bg-[#1C130D]/75 p-10 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="mb-5 text-5xl" aria-hidden="true">🕯️</div>
          <h1 className="mb-3 font-serif text-3xl font-bold tracking-wide text-[#FDFBF7]">
            Your shelves are currently bare...
          </h1>
          <p className="mb-8 text-[#D4C5B9]">
            Your Grimoire awaits its first tome. Wander the library, and bind the stories that call to you.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 px-8 py-3 font-semibold text-[#130D08] shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-amber-400"
          >
            Discover Tomes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10 text-center md:text-left">
        <h1 className="font-serif text-4xl font-bold tracking-wide text-[#FDFBF7]">
          My Grimoire
        </h1>
        <p className="mt-2 text-[#D4C5B9]">
          {favorites.length} {favorites.length === 1 ? "tome" : "tomes"} bound to your collection
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
        {favorites.map((item) => {
          const book = {
            id: item.book_id,
            title: item.book_title,
            author: item.book_author ?? "Unknown author",
            cover: item.book_cover,
          };

          return (
            <li
              key={item.id}
              className="group overflow-hidden rounded-xl border border-amber-900/30 bg-[#1C130D]/75 shadow-lg shadow-black/30 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-amber-600/50"
            >
              <div className="relative aspect-[2/3] w-full bg-[#130D08]">
                {book.cover ? (
                  <Image
                    src={book.cover}
                    alt={`Cover of ${book.title}`}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-4 text-center font-serif text-sm text-[#D4C5B9]/70">
                    No cover
                  </div>
                )}
                <div className="absolute right-2 top-2 z-10">
                  <FavoriteButton
                    book={book}
                    initialIsFavorited={true}
                    onToggle={(isFavorited) => {
                      if (!isFavorited) {
                        handleRemoveFavorite(book.id);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4">
                <h2 className="line-clamp-2 font-serif text-base font-semibold text-[#FDFBF7]" title={book.title}>
                  {book.title}
                </h2>
                <p className="mt-1 line-clamp-1 text-sm text-[#D4C5B9]">
                  {book.author}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}