import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (runs in the browser).
 * Call it inside components or handlers; @supabase/ssr reuses a single instance in the browser.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}