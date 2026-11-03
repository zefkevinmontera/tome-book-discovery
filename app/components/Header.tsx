"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LogOut, User as UserIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client"; // wraps createBrowserClient from @supabase/ssr

interface Profile {
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
}

function getProfile(user: User): Profile {
  const meta = (user.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
  const email = user.email ?? "";
  const name = meta.full_name ?? meta.name ?? (email.split("@")[0] || "Reader");
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "T";

  return { name, email, avatarUrl: meta.avatar_url ?? meta.picture, initials };
}

function Avatar({ profile, className }: { profile: Profile; className: string }) {
  const [failed, setFailed] = useState(false);

  if (profile.avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${className} grid place-items-center bg-[#D97706] text-xs font-semibold text-white`}
    >
      {profile.initials}
    </span>
  );
}

const itemClasses =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-[#D4C5B9] transition-colors hover:bg-amber-500/10 hover:text-[#FDFBF7] focus-visible:bg-amber-500/10 focus-visible:text-[#FDFBF7] focus-visible:outline-none";

const primaryButton =
  "rounded-md bg-gradient-to-r from-amber-600 to-amber-700 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(245,158,11,0.55)] transition-colors hover:from-amber-500 hover:to-amber-600";

function ProfileMenu({ user }: { user: User }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const profile = getProfile(user);

  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []
    );
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
    items[next].focus();
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);

    const { error } = await supabase.auth.signOut();
    setSigningOut(false);

    if (error) {
      setSignOutError(error.message);
      return;
    }

    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        className={`block rounded-full ring-offset-2 ring-offset-[#130D08] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
          open ? "ring-2 ring-amber-500" : "ring-1 ring-amber-900/40 hover:ring-amber-600/70"
        }`}
      >
        <Avatar profile={profile} className="h-8 w-8 rounded-full" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="Account menu"
            onKeyDown={handleMenuKeyDown}
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 rounded-xl border border-amber-900/30 bg-[#1C130D]/95 p-1.5 shadow-2xl shadow-black/70 backdrop-blur-md"
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Avatar profile={profile} className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-medium text-[#FDFBF7]">
                  {profile.name}
                </p>
                <p className="truncate text-xs text-[#D4C5B9]/70">{profile.email}</p>
              </div>
            </div>

            <div className="my-1.5 h-px bg-amber-900/30" />

            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClasses}
            >
              <UserIcon className="h-4 w-4 text-amber-600" aria-hidden />
              Profile
            </Link>

            <div className="my-1.5 h-px bg-amber-900/30" />

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:bg-red-500/10 focus-visible:text-red-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden />
              )}
              {signingOut ? "Closing the book" : "Sign out"}
            </button>

            {signOutError && (
              <p role="alert" className="px-3 pb-2 pt-1 text-xs text-red-300">
                {signOutError}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Header() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    // Initial session lookup (reads the stored session, no extra round trip).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setChecking(false);
    });

    // Keep the header in sync with sign in, sign out and token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <header className="sticky top-0 z-20 border-b border-amber-900/20 bg-[#130D08]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Tome home">
          <Image
            src="/tome-logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-full object-cover drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]"
          />
          <span className="font-serif text-lg font-semibold tracking-wide text-[#FDFBF7]">
            Tome
          </span>
        </Link>

        <div className="flex items-center gap-6">
          {/* THE NEW GRIMOIRE LINK */}
          <Link
            href="/grimoire"
            className="text-sm font-medium text-[#D4C5B9] transition-colors hover:text-amber-400"
          >
            My Grimoire
          </Link>

          <div className="flex min-w-[32px] items-center justify-end gap-4">
            {checking ? (
              <div aria-busy="true" aria-label="Checking account" className="flex items-center gap-3">
                <div className="skeleton hidden h-4 w-12 rounded sm:block" />
                <div className="skeleton h-8 w-8 rounded-full" />
              </div>
            ) : user ? (
              <ProfileMenu user={user} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-amber-400 transition-colors hover:text-[#FDFBF7]"
                >
                  Log in
                </Link>
                <Link href="/login" className={primaryButton}>
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}