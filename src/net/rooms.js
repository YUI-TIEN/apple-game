// Single public entry point for the room/score data layer. Every screen
// module should `import * as rooms from '../net/rooms.js'` (or named
// imports) and never touch supabaseClient.js / mockRooms.js directly.
//
// When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are both set, every
// function here talks to Supabase (see supabase/schema.sql for the
// tables/RLS this relies on). When either is missing, everything delegates
// to mockRooms.js's localStorage-backed stand-in and isBackendConfigured()
// reports false so the UI can show a "local demo mode" hint if it wants to.
//
// RoomError / RoomErrorCode / normalizeTeamName / generateRoomCode /
// sortScores are implemented in mockRooms.js (see the note at the top of
// that file for why) and re-exported here — this file is still the only
// place other modules should import them from.

import { getSupabase, hasSupabaseCredentials } from './supabaseClient.js';
import {
  RoomError,
  RoomErrorCode,
  normalizeTeamName,
  generateRoomCode,
  sortScores,
  createRoom as mockCreateRoom,
  getRoom as mockGetRoom,
  lockRoom as mockLockRoom,
  checkTeamName as mockCheckTeamName,
  submitScore as mockSubmitScore,
  listScores as mockListScores,
  subscribeScores as mockSubscribeScores,
} from './mockRooms.js';

export { RoomError, RoomErrorCode };

export function isBackendConfigured() {
  return hasSupabaseCredentials;
}

// =====================================================================
// Supabase error handling helpers
// =====================================================================

// Runs a PostgREST/Realtime builder and normalizes both failure shapes
// (`{ data, error }` and a thrown exception) into `{ data, error }`. A
// thrown exception here means the request never got a response at all
// (offline, DNS failure, CORS, timeout) — that's exactly what NETWORK_ERROR
// means downstream, as opposed to a well-formed Postgres/PostgREST error
// (unique violation, RLS denial, ...), which arrives as `error` with a
// `.code`.
async function runSupabase(builder) {
  try {
    return await builder;
  } catch (cause) {
    return { data: null, error: { networkFailure: true, cause } };
  }
}

function toRoomError(error) {
  if (!error) return new RoomError(RoomErrorCode.UNKNOWN);
  if (error.networkFailure) {
    return new RoomError(RoomErrorCode.NETWORK, {
      message: error.cause?.message ?? String(error.cause ?? 'network request failed'),
    });
  }
  return new RoomError(RoomErrorCode.UNKNOWN, {
    message: error.message,
    dbCode: error.code,
    hint: error.hint,
  });
}

function toPublicRoom(row) {
  return { code: row.code, title: row.title ?? null, locked: !!row.locked, createdAt: row.created_at };
}

function toPublicScoreRow(row) {
  return {
    id: row.id,
    teamName: row.team_name,
    score: row.score,
    note: row.note ?? null,
    createdAt: row.created_at,
  };
}

// =====================================================================
// Room CRUD
// =====================================================================

const MAX_ROOM_CODE_ATTEMPTS = 8;

export async function createRoom({ title } = {}) {
  if (!hasSupabaseCredentials) return mockCreateRoom({ title });

  let lastError = null;
  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const sb = await getSupabase();
    const { data, error } = await runSupabase(
      sb.from('rooms').insert({ code, title: title ?? null }).select().single()
    );
    if (!error) return toPublicRoom(data);
    if (error.code === '23505') {
      // Room-code collision on the primary key — vanishingly unlikely at
      // 31^4 ≈ 9.2e5 combinations, but this loop is exactly what makes it a
      // non-issue: just draw a new code and try again.
      lastError = error;
      continue;
    }
    throw toRoomError(error);
  }
  throw new RoomError(RoomErrorCode.UNKNOWN, { reason: 'room-code-exhausted', dbCode: lastError?.code });
}

export async function getRoom(code) {
  if (!hasSupabaseCredentials) return mockGetRoom(code);

  const sb = await getSupabase();
  const { data, error } = await runSupabase(
    sb.from('rooms').select('code, title, locked, created_at').eq('code', code).maybeSingle()
  );
  if (error) throw toRoomError(error);
  if (!data) throw new RoomError(RoomErrorCode.NOT_FOUND);
  return toPublicRoom(data);
}

export async function lockRoom(code) {
  if (!hasSupabaseCredentials) return mockLockRoom(code);

  // Only the `locked` column is actually grantable for UPDATE (see
  // supabase/schema.sql) — sending anything else here would be rejected by
  // Postgres regardless of what this function does.
  const sb = await getSupabase();
  const { data, error } = await runSupabase(
    sb.from('rooms').update({ locked: true }).eq('code', code).select().maybeSingle()
  );
  if (error) throw toRoomError(error);
  if (!data) throw new RoomError(RoomErrorCode.NOT_FOUND);
  return toPublicRoom(data);
}

// =====================================================================
// Team-name pre-check (best-effort UX; submitScore's DB constraint is the
// actual source of truth — see the module comment above and #4).
// =====================================================================

export async function checkTeamName(code, teamName) {
  if (!hasSupabaseCredentials) return mockCheckTeamName(code, teamName);

  const room = await getRoom(code); // throws NOT_FOUND
  if (room.locked) throw new RoomError(RoomErrorCode.LOCKED);

  const normalized = normalizeTeamName(teamName);
  const sb = await getSupabase();
  const { data, error } = await runSupabase(
    sb.from('scores').select('score, created_at').eq('room_code', code).eq('team_name', normalized).maybeSingle()
  );
  if (error) throw toRoomError(error);
  if (data) {
    throw new RoomError(RoomErrorCode.TEAM_TAKEN, { score: data.score, createdAt: data.created_at });
  }
}

// =====================================================================
// Score submission
// =====================================================================

// Best-effort re-fetch of the row that won the unique-constraint race, so
// the UI can show "already submitted: score N at hh:mm" (issue #3). This is
// a read, never a write, so it cannot itself create a duplicate row.
async function fetchExistingScoreForTeamTaken(roomCode, teamName) {
  const normalized = normalizeTeamName(teamName);
  const sb = await getSupabase();
  const { data, error } = await runSupabase(
    sb.from('scores').select('score, created_at').eq('room_code', roomCode).eq('team_name', normalized).maybeSingle()
  );
  if (error || !data) {
    // Should not happen — we just hit that row's unique constraint, so it
    // must exist — but degrade gracefully instead of masking the original
    // TEAM_TAKEN error with a second, unrelated one.
    return { score: null, createdAt: null };
  }
  return { score: data.score, createdAt: data.created_at };
}

export async function submitScore({ roomCode, teamName, score, note }) {
  if (!hasSupabaseCredentials) return mockSubmitScore({ roomCode, teamName, score, note });

  // Pre-check against `rooms` so NOT_FOUND and LOCKED can be told apart in
  // the error the UI sees. The scores INSERT policy in supabase/schema.sql
  // rejects both cases with the same generic RLS error (Postgres 42501), so
  // on its own it can't carry enough information for a specific message.
  const room = await getRoom(roomCode); // throws NOT_FOUND
  if (room.locked) throw new RoomError(RoomErrorCode.LOCKED);

  const sb = await getSupabase();
  const { data, error } = await runSupabase(
    sb
      .from('scores')
      .insert({ room_code: roomCode, team_name: teamName, score, note: note ?? null })
      .select()
      .single()
  );

  if (error) {
    if (error.code === '23505') {
      // Unique violation on (room_code, normalized team_name): someone else
      // (or another tab/request from the same player) already has a row for
      // this team. Retrying submitScore after seeing this is always safe —
      // it can only ever hit this same branch again, never create a second
      // row, because the DB constraint (not this function) is what's
      // preventing the duplicate.
      const existing = await fetchExistingScoreForTeamTaken(roomCode, teamName);
      throw new RoomError(RoomErrorCode.TEAM_TAKEN, existing);
    }
    if (error.code === '42501') {
      // RLS rejected the write. We confirmed the room existed and was
      // unlocked a moment ago (above), so the only realistic explanation
      // left is that the host locked it in the gap between that check and
      // this insert — map it to LOCKED rather than a generic error.
      throw new RoomError(RoomErrorCode.LOCKED);
    }
    throw toRoomError(error);
  }

  return toPublicScoreRow(data);
}

// =====================================================================
// Leaderboard read + realtime subscription
// =====================================================================

export async function listScores(roomCode) {
  if (!hasSupabaseCredentials) return mockListScores(roomCode);

  const sb = await getSupabase();
  const { data, error } = await runSupabase(
    sb.from('scores').select('id, team_name, score, note, created_at').eq('room_code', roomCode)
  );
  if (error) throw toRoomError(error);
  return sortScores((data ?? []).map(toPublicScoreRow));
}

export function subscribeScores(roomCode, onInsert) {
  if (!hasSupabaseCredentials) return mockSubscribeScores(roomCode, onInsert);

  // `filter` scopes which INSERT events this particular subscription
  // receives to this room, evaluated server-side by Realtime — independent
  // of (and narrower than) what the scores SELECT RLS policy allows a plain
  // REST query to read. See supabase/schema.sql's honesty note on why the
  // SELECT policy itself can't be scoped the same way.
  // The client arrives asynchronously (lazy SDK chunk), so the subscription
  // is wired up once it lands. Unsubscribing before that simply cancels it.
  let channel = null;
  let cancelled = false;

  getSupabase().then((sb) => {
    if (cancelled) return;
    channel = sb
      .channel(`scores-insert-${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scores', filter: `room_code=eq.${roomCode}` },
        (payload) => onInsert(toPublicScoreRow(payload.new))
      )
      .subscribe();
  });

  return () => {
    cancelled = true;
    if (!channel) return;
    getSupabase().then((sb) => sb.removeChannel(channel));
  };
}
