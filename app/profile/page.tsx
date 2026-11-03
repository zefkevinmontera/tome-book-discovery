"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import Header from "@/app/components/Header";
import { createClient } from "@/lib/supabase/client";

/* -------------------------------------------------------------------------- */
/*                              Types and constants                           */
/* -------------------------------------------------------------------------- */

const BUCKET = "profile-media";
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

interface ProfileRow {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
}

interface FormState {
  firstName: string;
  lastName: string;
  username: string;
}

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

const USERNAME_HELP: Record<UsernameStatus, string> = {
  idle: "Your pen name in the library: 3 to 30 lowercase letters, numbers, - and _.",
  checking: "Consulting the registry",
  available: "This pen name is free.",
  taken: "Another scribe already holds that pen name.",
  invalid: "Use 3 to 30 lowercase letters, numbers, - or _.",
  error: "The registry didn't answer. Try again in a moment.",
};

const EMPTY_FORM: FormState = { firstName: "", lastName: "", username: "" };

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

function messageOf(err: unknown): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "The spell fizzled. Try again.";
}

function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

const inputClasses =
  "h-11 w-full rounded-lg border border-amber-900/30 bg-black/20 px-3.5 text-sm text-[#FDFBF7] outline-none transition-[border-color,box-shadow] placeholder:text-[#D4C5B9]/45 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60";

const coverButtonClasses =
  "grid h-10 w-10 place-items-center rounded-full bg-black/55 text-[#FDFBF7] ring-1 ring-amber-500/30 backdrop-blur transition-colors hover:bg-black/75 hover:ring-amber-500/60";

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saved, setSaved] = useState<FormState>(EMPTY_FORM);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarPreview = useObjectUrl(avatarFile);
  const coverPreview = useObjectUrl(coverFile);

  /* ----------------------------- Load profile ----------------------------- */

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("first_name,last_name,username,full_name,avatar_url,cover_url")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>();

      if (!active) return;
      if (fetchError) setError(fetchError.message);

      // Fall back to the name and photo that Google provided.
      const meta = (user.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
      };
      const fullName = data?.full_name ?? meta.full_name ?? meta.name ?? "";
      const [fallbackFirst, ...fallbackRest] = fullName.trim().split(/\s+/).filter(Boolean);

      const next: FormState = {
        firstName: data?.first_name ?? fallbackFirst ?? "",
        lastName: data?.last_name ?? fallbackRest.join(" "),
        username: data?.username ?? "",
      };

      setUserId(user.id);
      setForm(next);
      setSaved({ ...next, firstName: data?.first_name ?? "", lastName: data?.last_name ?? "" });
      setAvatarUrl(data?.avatar_url ?? meta.avatar_url ?? meta.picture ?? null);
      setCoverUrl(data?.cover_url ?? null);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase, router]);

  /* ------------------------- Username availability ------------------------ */

  useEffect(() => {
    if (loading) return;

    const value = form.username;
    if (!value) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setUsernameStatus("invalid");
      return;
    }
    if (value === saved.username) {
      setUsernameStatus("available");
      return;
    }

    setUsernameStatus("checking");
    let cancelled = false;

    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("is_username_available", {
        p_username: value,
      });
      if (cancelled) return;
      if (rpcError) {
        setUsernameStatus("error");
        return;
      }
      setUsernameStatus(data ? "available" : "taken");
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.username, saved.username, loading, supabase]);

  /* ------------------------------- Derived -------------------------------- */

  const avatarSrc = avatarPreview ?? avatarUrl;
  const coverSrc = coverPreview ?? (coverRemoved ? null : coverUrl);
  const initials =
    `${form.firstName[0] ?? ""}${form.lastName[0] ?? ""}`.toUpperCase() || "T";

  const isDirty =
    form.firstName.trim() !== saved.firstName ||
    form.lastName.trim() !== saved.lastName ||
    form.username !== saved.username ||
    avatarFile !== null ||
    coverFile !== null ||
    coverRemoved;

  const usernameBlocked =
    usernameStatus === "checking" ||
    usernameStatus === "taken" ||
    usernameStatus === "invalid";

  const canSave = !loading && !saving && isDirty && !usernameBlocked;

  /* ------------------------------- Handlers ------------------------------- */

  function updateField(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setNotice(null);
  }

  function handlePick(kind: "avatar" | "cover") {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Use a JPG, PNG or WebP image.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Images must be 5 MB or smaller.");
        return;
      }

      setError(null);
      setNotice(null);
      if (kind === "avatar") {
        setAvatarFile(file);
      } else {
        setCoverFile(file);
        setCoverRemoved(false);
      }
    };
  }

  function removeCover() {
    setCoverFile(null);
    setCoverRemoved(true);
    setNotice(null);
  }

  async function uploadImage(file: File, kind: "avatar" | "cover"): Promise<string> {
    const path = `${userId}/${kind}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    // The path never changes, so a version param busts the browser and CDN cache.
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave || !userId) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const username = form.username;
      const fullName = [firstName, lastName].filter(Boolean).join(" ");

      let nextAvatar = avatarUrl;
      let nextCover = coverRemoved ? null : coverUrl;
      if (avatarFile) nextAvatar = await uploadImage(avatarFile, "avatar");
      if (coverFile) nextCover = await uploadImage(coverFile, "cover");

      const { error: saveError } = await supabase.from("profiles").upsert({
        id: userId,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: fullName || null,
        username: username || null,
        avatar_url: nextAvatar,
        cover_url: nextCover,
      });
      if (saveError) {
        if ((saveError as { code?: string }).code === "23505") {
          setUsernameStatus("taken");
          throw new Error("That pen name was just claimed by another scribe. Try a different one.");
        }
        throw saveError;
      }

      // Keep the header avatar and name in sync with the new profile.
      const metadata: Record<string, string> = {};
      if (fullName) metadata.full_name = fullName;
      if (nextAvatar) metadata.avatar_url = nextAvatar;
      if (Object.keys(metadata).length > 0) {
        const { error: metaError } = await supabase.auth.updateUser({ data: metadata });
        if (metaError) throw metaError;
      }

      setSaved({ firstName, lastName, username });
      setForm({ firstName, lastName, username });
      setAvatarUrl(nextAvatar);
      setCoverUrl(nextCover);
      setAvatarFile(null);
      setCoverFile(null);
      setCoverRemoved(false);
      setNotice("Your entry has been inscribed in the archive.");
      router.refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSaving(false);
    }
  }

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="relative min-h-screen bg-[#130D08] text-[#D4C5B9]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(217,119,6,0.2),transparent)]"
      />

      <Header />

      <main className="relative px-4 py-8 sm:py-12">
        <form
          onSubmit={handleSave}
          aria-labelledby="edit-profile-title"
          className="mx-auto flex max-h-[calc(100vh-8rem)] w-full max-w-[510px] flex-col overflow-hidden rounded-2xl border border-amber-900/30 bg-[#1C130D] shadow-2xl shadow-black/60"
        >
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-amber-900/30 px-6 py-4">
            <h1
              id="edit-profile-title"
              className="font-serif text-base font-semibold tracking-wide text-[#FDFBF7]"
            >
              Edit your profile
            </h1>
            <button
              type="button"
              onClick={() => router.push("/")}
              aria-label="Close"
              className="rounded-md p-1 text-[#D4C5B9]/70 transition-colors hover:bg-amber-500/10 hover:text-[#FDFBF7]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div aria-busy="true" aria-label="Loading profile">
                <div className="skeleton h-32 w-full" />
                <div className="skeleton -mt-10 ml-6 h-20 w-20 rounded-full border-4 border-[#1C130D]" />
                <div className="space-y-5 p-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="skeleton h-14 rounded-lg" />
                    <div className="skeleton h-14 rounded-lg" />
                  </div>
                  <div className="skeleton h-14 rounded-lg" />
                </div>
              </div>
            ) : (
              <>
                {/* Cover photo */}
                <div className="relative h-32 w-full overflow-hidden bg-[radial-gradient(80%_120%_at_50%_0%,rgba(217,119,6,0.4),#2a1c12)]">
                  {coverSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverSrc}
                      alt="Profile cover"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      aria-label={coverSrc ? "Change cover photo" : "Upload cover photo"}
                      className={coverButtonClasses}
                    >
                      <ImagePlus className="h-4 w-4" aria-hidden />
                    </button>
                    {coverSrc && (
                      <button
                        type="button"
                        onClick={removeCover}
                        aria-label="Remove cover photo"
                        className={coverButtonClasses}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    onChange={handlePick("cover")}
                    className="hidden"
                  />
                </div>

                {/* Avatar overlapping the cover */}
                <div className="relative z-10 -mt-10 ml-6 h-20 w-20">
                  <div className="h-full w-full overflow-hidden rounded-full border-4 border-[#1C130D] bg-[#D97706]">
                    {avatarSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarSrc}
                        alt="Your avatar"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="grid h-full w-full place-items-center font-serif text-xl font-semibold text-white"
                      >
                        {initials}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="Change avatar"
                    className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-[#FDFBF7] transition-colors hover:bg-black/60"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    onChange={handlePick("avatar")}
                    className="hidden"
                  />
                </div>

                {/* Fields */}
                <div className="space-y-5 p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        htmlFor="first-name"
                        className="block text-sm font-semibold text-[#FDFBF7]"
                      >
                        First name
                      </label>
                      <input
                        id="first-name"
                        type="text"
                        required
                        autoComplete="given-name"
                        value={form.firstName}
                        onChange={(e) => updateField("firstName", e.target.value)}
                        disabled={saving}
                        className={inputClasses}
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="last-name"
                        className="block text-sm font-semibold text-[#FDFBF7]"
                      >
                        Last name
                      </label>
                      <input
                        id="last-name"
                        type="text"
                        autoComplete="family-name"
                        value={form.lastName}
                        onChange={(e) => updateField("lastName", e.target.value)}
                        disabled={saving}
                        className={inputClasses}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="username" className="block text-sm font-semibold text-[#FDFBF7]">
                      Username
                    </label>
                    <div className="relative">
                      <input
                        id="username"
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={form.username}
                        onChange={(e) =>
                          updateField(
                            "username",
                            e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                          )
                        }
                        disabled={saving}
                        maxLength={30}
                        aria-describedby="username-help"
                        aria-invalid={usernameStatus === "taken" || usernameStatus === "invalid"}
                        placeholder="your-pen-name"
                        className={`${inputClasses} pr-10`}
                      />
                      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
                        {usernameStatus === "checking" && (
                          <Loader2 className="h-4 w-4 animate-spin text-amber-500" aria-hidden />
                        )}
                        {usernameStatus === "available" && (
                          <Check className="h-4 w-4 text-[#7FBF93]" aria-hidden />
                        )}
                        {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                          <X className="h-4 w-4 text-red-400" aria-hidden />
                        )}
                      </span>
                    </div>
                    <p
                      id="username-help"
                      aria-live="polite"
                      className={`text-xs ${
                        usernameStatus === "available"
                          ? "text-[#7FBF93]"
                          : usernameStatus === "taken" || usernameStatus === "invalid"
                            ? "text-red-400"
                            : "text-[#D4C5B9]/70"
                      }`}
                    >
                      {USERNAME_HELP[usernameStatus]}
                    </p>
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
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-amber-900/30 px-6 py-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              disabled={saving}
              className="h-10 rounded-lg border border-amber-900/40 bg-transparent px-4 text-sm font-semibold text-[#FDFBF7] transition-colors hover:bg-amber-500/10 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 px-4 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(245,158,11,0.6)] transition-colors hover:from-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {saving ? "Inscribing" : "Save changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}