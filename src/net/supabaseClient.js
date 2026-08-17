// Supabase client bootstrap.
//
// The SDK is imported lazily: a solo player never opens a room screen, and at
// an event thirty phones load this page over shared wifi, so the ~76 kB gzip
// of @supabase/supabase-js must not sit in the entry bundle. Vite splits the
// dynamic import into its own chunk that is fetched the first time a room
// call actually happens.
//
// This module intentionally never throws: src/net/rooms.js is the single
// public entry point for the rest of the app, and it falls back to the
// localStorage-backed mock (src/net/mockRooms.js) whenever the VITE_SUPABASE_*
// variables are missing. Throwing here would take down the whole app instead
// of degrading gracefully.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseCredentials = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise = null;

// Resolves to the client, or to null when credentials are missing — callers
// (rooms.js) check hasSupabaseCredentials / isBackendConfigured() first.
export function getSupabase() {
  if (!hasSupabaseCredentials) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
          params: {
            // Score inserts arrive in short bursts right after a round ends;
            // the default (10) is plenty, set explicitly for clarity.
            eventsPerSecond: 10,
          },
        },
      }),
    );
  }
  return clientPromise;
}
