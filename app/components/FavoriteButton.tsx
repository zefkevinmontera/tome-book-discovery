"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface FavoriteButtonProps {
  book: {
    id: string;
    title: string;
    author?: string;
    cover?: string | null;
  };
  initialIsFavorited?: boolean;
  onToggle?: (isFavorited: boolean) => void;
}

export default function FavoriteButton({
  book,
  initialIsFavorited = false,
  onToggle,
}: FavoriteButtonProps) {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsFavorited(initialIsFavorited);
  }, [initialIsFavorited]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const nextState = !isFavorited;
    setIsFavorited(nextState);

    // Notify parent immediately
    if (onToggle) {
      onToggle(nextState);
    }

    try {
      if (!nextState) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("book_id", book.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id,
          book_id: book.id,
          book_title: book.title,
          book_author: book.author || "Unknown Scholar",
          book_cover: book.cover || "",
        });

        if (error) throw error;
      }

      router.refresh();
    } catch (error) {
      console.error("Grimoire update failed:", error);
      setIsFavorited(!nextState);
      if (onToggle) {
        onToggle(!nextState);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      aria-label={isFavorited ? "Remove from Grimoire" : "Save to Grimoire"}
      className={`
        group relative p-2.5 rounded-full backdrop-blur-md transition-all duration-300 border shadow-lg
        hover:scale-110 active:scale-95
        ${
          isFavorited
            ? "bg-[#1C130D]/90 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            : "bg-[#130D08]/60 border-amber-900/40 text-amber-100/50 hover:text-amber-300 hover:border-amber-500/60 hover:bg-[#1C130D]/80"
        }
      `}
    >
      <Bookmark
        className={`
          w-5 h-5 transition-all duration-300
          ${isFavorited ? "fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" : ""}
          ${isAnimating ? "scale-125" : "scale-100"}
        `}
      />
    </button>
  );
}