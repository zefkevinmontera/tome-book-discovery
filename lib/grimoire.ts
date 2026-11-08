import type { SupabaseClient } from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type ReadingStatus = "want_to_read" | "currently_reading" | "finished";

export const STATUS_OPTIONS: ReadonlyArray<{
  value: ReadingStatus;
  label: string;
  short: string;
}> = [
  { value: "want_to_read", label: "Want to Read", short: "To read" },
  { value: "currently_reading", label: "Currently Reading", short: "Reading" },
  { value: "finished", label: "Finished", short: "Finished" },
];

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  want_to_read: "Want to Read",
  currently_reading: "Currently Reading",
  finished: "Finished",
};

export const STATUS_SHORT: Record<ReadingStatus, string> = {
  want_to_read: "To read",
  currently_reading: "Reading",
  finished: "Finished",
};

export const MAX_SHELF_LENGTH = 40;
export const MAX_NOTES_LENGTH = 10000;

/** The minimum we need to know about a book to bind it. */
export interface BookRef {
  id: string;
  title: string;
  author: string | null;
  cover: string | null;
}

/** A row as shown in lists (no note body, only a flag). */
export interface GrimoireListEntry {
  id: string;
  book_id: string;
  book_title: string;
  book_author: string | null;
  book_cover: string | null;
  status: ReadingStatus;
  custom_shelf: string | null;
  has_notes: boolean;
  created_at: string;
  updated_at: string;
}

export interface GrimoireEntry extends GrimoireListEntry {
  notes: string | null;
}

/** What the shelf controls need to render. */
export type ShelfState = Pick<GrimoireListEntry, "status" | "custom_shelf" | "has_notes">;

export type EntryPatch = Partial<Pick<GrimoireEntry, "status" | "custom_shelf" | "notes">>;

export const LIST_COLUMNS =
  "id, book_id, book_title, book_author, book_cover, status, custom_shelf, has_notes, created_at, updated_at";
export const FULL_COLUMNS = `${LIST_COLUMNS}, notes`;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}

/**
 * Create the entry if it doesn't exist, otherwise update only the fields in
 * `patch`. PostgREST updates just the columns present in the payload, so a
 * status change never clobbers notes (and vice versa).
 */
export async function saveEntry(
  supabase: SupabaseClient,
  book: BookRef,
  patch: EntryPatch = {}
): Promise<GrimoireEntry> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthRequiredError();

  const { data, error } = await supabase
    .from("grimoire_entries")
    .upsert(
      {
        user_id: user.id,
        book_id: book.id,
        book_title: book.title,
        book_author: book.author,
        book_cover: book.cover,
        ...patch,
      },
      { onConflict: "user_id,book_id" }
    )
    .select(FULL_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as GrimoireEntry;
}

/** Deletes the entry, including its notes. Callers should confirm first. */
export async function removeEntry(supabase: SupabaseClient, bookId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AuthRequiredError();

  const { error } = await supabase
    .from("grimoire_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("book_id", bookId);

  if (error) throw error;
}

/** Trim, collapse whitespace, and reuse existing casing for a known shelf. */
export function normalizeShelfName(input: string, existing: string[] = []): string | null {
  const cleaned = input.replace(/\s+/g, " ").trim().slice(0, MAX_SHELF_LENGTH);
  if (!cleaned) return null;
  return existing.find((s) => s.toLowerCase() === cleaned.toLowerCase()) ?? cleaned;
}

/** Case-insensitive unique shelf names, sorted alphabetically. */
export function uniqueShelves(rows: ReadonlyArray<{ custom_shelf: string | null }>): string[] {
  const seen = new Map<string, string>();
  for (const { custom_shelf } of rows) {
    if (!custom_shelf) continue;
    const key = custom_shelf.toLowerCase();
    if (!seen.has(key)) seen.set(key, custom_shelf);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function sameShelf(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
}