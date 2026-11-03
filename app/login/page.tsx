"use client";

import { useState, type FormEvent, type SVGProps } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

/** lucide-react no longer ships brand logos, so the Google "G" is inlined. */
function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

const inputClasses =
  "h-11 w-full rounded-xl border border-amber-900/40 bg-black/30 px-4 text-sm text-[#FDFBF7] outline-none transition-[border-color,box-shadow] placeholder:text-[#D4C5B9]/45 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-60";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === "signup";

  function toggleMode() {
    if (loading) return;
    setMode(isSignUp ? "login" : "signup");
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = createClient();

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        // With email confirmation enabled, Supabase returns no session yet.
        if (!data.session) {
          setNotice("A raven is on its way. Check your email to confirm your account, then log in.");
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The spell fizzled. Try again.");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (loading) return;

    setLoading(true);
    setGoogleLoading(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) throw oauthError;
      // On success the browser redirects to Google, so there is nothing else to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in.");
      setLoading(false);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#130D08] text-[#D4C5B9] md:grid-cols-2">
      {/* Left column: form over the cat-at-the-window scene */}
      <div className="relative flex items-center justify-center overflow-hidden px-6 py-16">
        <Image
          src="/login-bg.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/80 to-[#130D08]/95"
        />

        <Link
          href="/"
          aria-label="Back to Tome home"
          className="absolute left-6 top-6 z-10 inline-flex items-center gap-2.5 rounded-full border border-amber-900/40 bg-[#1C130D]/70 py-1.5 pl-1.5 pr-4 backdrop-blur-md transition-colors hover:border-amber-600/60 hover:bg-[#1C130D]/90"
        >
          <Image
            src="/tome-logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 rounded-full object-cover drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]"
          />
          <span className="font-serif text-base font-semibold tracking-wide text-[#FDFBF7]">
            Tome
          </span>
        </Link>

        <div className="relative z-10 w-full max-w-[350px]">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#FDFBF7]">
              {isSignUp ? "Join the archive" : "Enter the archive"}
            </h1>
            <p className="mt-2 text-sm text-[#D4C5B9]">
              {isSignUp
                ? "Inscribe your email below to begin your journey"
                : "Speak your email below to unseal the library"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-[#FDFBF7]">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                placeholder="scribe@example.com"
                className={inputClasses}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-[#FDFBF7]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="Your secret word"
                  className={`${inputClasses} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#D4C5B9]/60 transition-colors hover:text-amber-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="rounded-xl border border-[#4D7C5D]/50 bg-[#2D4A3E]/50 px-4 py-3 text-sm text-[#B7DCC4]"
              >
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(245,158,11,0.6)] transition-colors hover:from-amber-500 hover:to-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && !googleLoading && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {loading && !googleLoading
                ? isSignUp
                  ? "Inscribing"
                  : "Unsealing"
                : isSignUp
                  ? "Begin the journey"
                  : "Enter the library"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#D4C5B9]">
            {isSignUp ? "Already a keeper of the archive?" : "New to the archive?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              disabled={loading}
              className="font-semibold text-amber-400 transition-colors hover:text-amber-300 disabled:opacity-60"
            >
              {isSignUp ? "Log in" : "Sign up"}
            </button>
          </p>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-amber-900/40" />
            <span className="text-sm text-[#D4C5B9]/70">Or summon with</span>
            <div className="h-px flex-1 bg-amber-900/40" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-amber-900/40 bg-black/30 text-sm font-semibold text-[#FDFBF7] transition-colors hover:border-amber-600/60 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <GoogleIcon className="h-4 w-4" />
            )}
            Continue with Google
          </button>
        </div>
      </div>

      {/* Right column: alchemist showcase (tablet and up) */}
      <div className="relative hidden overflow-hidden border-l border-amber-900/30 md:block">
        <Image
          src="/alchemist-bg.jpg"
          alt=""
          fill
          sizes="50vw"
          className="object-cover"
        />
        {/* Warm ambient overlay: candle glow on top, deep mahogany at the base */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#130D08] via-[#130D08]/25 to-amber-900/20"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60%_45%_at_50%_30%,rgba(245,158,11,0.16),transparent)]"
        />

        <figure className="absolute inset-x-0 bottom-0 px-12 pb-12 pt-24 text-center">
          <blockquote className="font-serif text-2xl font-medium leading-snug text-[#FDFBF7] [text-shadow:0_2px_16px_rgba(0,0,0,0.7)]">
            &ldquo;Light the lamp, open the grimoire, and let the old pages whisper what to read next.&rdquo;
          </blockquote>
          <figcaption className="mt-3 text-sm text-[#D4C5B9]">The Keeper of Tome</figcaption>
        </figure>
      </div>
    </div>
  );
}