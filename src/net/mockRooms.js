// Local, no-backend stand-in for the Supabase-backed implementation in
// rooms.js. Used whenever VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not
// configured, so the whole join → play → submit → leaderboard flow can be
// exercised on a single machine with no network at all.
//
// Design notes:
//   - State lives in localStorage (`apple-game:mock:*`) so a page refresh
//     doesn't lose rooms/scores mid-event.
//   - New scores are broadcast across tabs with BroadcastChannel, so a
//     "host" tab and a "player" tab on the same machine behave like the real
//     Supabase Realtime flow (host sees new scores without reloading).
//   - Every error path the real backend can produce (NOT_FOUND, LOCKED,
//     TEAM_TAKEN with details, team-name normalization before comparison) is
//     reproduced here on purpose — this is the only way the UI's error
//     handling (issue #3's 防呆清單) can be exercised without a live
//     Supabase project.
//   - This module also owns the small pure helpers (RoomError,
//     RoomErrorCode, normalizeTeamName, generateRoomCode, sortScores) that
//     `rooms.js` re-exports and reuses for its real Supabase implementation.
//     They live here (rather than in rooms.js, which then imports mock CRUD
//     functions) specifically to keep the dependency one-directional —
//     rooms.js -> mockRooms.js only — and avoid a circular ES module import
//     between the two files.
//
// Known limitation: this mock cannot reproduce a genuine NETWORK_ERROR
// (there is no network), and it cannot guarantee true cross-tab atomicity
// the way a Postgres unique constraint does — two tabs racing to read+write
// localStorage within the same tick could theoretically both "win". That's
// fine for its purpose (driving UI/error-path testing locally); it is not a
// substitute for the DB-level guarantee described in supabase/schema.sql.

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../app/validation.js';

const ROOMS_KEY = 'apple-game:mock:rooms:v1';
const SCORES_KEY = 'apple-game:mock:scores:v1';
const CHANNEL_NAME = 'apple-game:mock:scores-channel:v1';

// =====================================================================
// Shared pure primitives (also used by rooms.js's real implementation)
// =====================================================================

export const RoomErrorCode = {
  NOT_FOUND: 'ROOM_NOT_FOUND',
  LOCKED: 'ROOM_LOCKED',
  TEAM_TAKEN: 'TEAM_NAME_TAKEN',
  NETWORK: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

export class RoomError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'RoomError';
    this.code = code;
    this.details = details;
  }
}

// The alphabet excludes 0/O/1/I/L because a host reads the code aloud to a
// room full of people. It is imported rather than redeclared so the generator
// and the join form can never drift apart; the DB check constraint in
// supabase/schema.sql is the third copy and must be updated by hand.
export { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH };

export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

// Trim + collapse internal whitespace runs to a single space. Mirrors the
// `normalize_score_team_name()` trigger in supabase/schema.sql exactly —
// keep the two in sync if this ever changes.
export function normalizeTeamName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

// Score high to low; ties broken by earliest submission first. Shared by
// both the mock and the real backend (rooms.js re-fetches unsorted and
// calls this) so the tie-break rule can't drift between the two paths.
export function sortScores(scores) {
  return [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = Date.parse(a.createdAt);
    const bt = Date.parse(b.createdAt);
    if (at !== bt) return at - bt;
    // Millisecond-timestamp tie (possible under concurrent submits): lower
    // id was written first, since ids are assigned in insertion order both
    // here and via Postgres's identity column.
    return numericId(a.id) - numericId(b.id);
  });
}

function numericId(id) {
  const n = Number(id);
  return Number.isFinite(n) ? n : 0;
}

// =====================================================================
// localStorage-backed persistence
// =====================================================================

function readRooms() {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeRooms(map) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(map));
}

function readScoreState() {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return { nextId: 1, items: [] };
    const parsed = JSON.parse(raw);
    return {
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { nextId: 1, items: [] };
  }
}

function writeScoreState(state) {
  localStorage.setItem(SCORES_KEY, JSON.stringify(state));
}

function toPublicRoom(room) {
  return { code: room.code, title: room.title ?? null, locked: !!room.locked, createdAt: room.createdAt };
}

function toPublicScore(record) {
  return {
    id: record.id,
    teamName: record.teamName,
    score: record.score,
    note: record.note ?? null,
    createdAt: record.createdAt,
  };
}

// =====================================================================
// Cross-tab broadcast (BroadcastChannel does not deliver to the sender's
// own context, so same-tab listeners are also kept and notified directly.)
// =====================================================================

let channel = null;
function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

const localListeners = new Map(); // roomCode -> Set<onInsert>

function notifyLocal(roomCode, score) {
  const set = localListeners.get(roomCode);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(score);
    } catch (err) {
      // A subscriber's own handler throwing shouldn't break the mock backend.
      console.error('[mockRooms] subscribeScores listener threw', err);
    }
  }
}

function broadcastInsert(roomCode, score) {
  notifyLocal(roomCode, score);
  getChannel()?.postMessage({ type: 'score:insert', roomCode, score });
}

// =====================================================================
// Public mock CRUD — mirrors src/net/rooms.js's contract 1:1
// =====================================================================

const MAX_CODE_ATTEMPTS = 20;

export async function createRoom({ title } = {}) {
  const rooms = readRooms();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    if (rooms[code]) continue; // local collision — same as a DB unique-key retry
    const room = { code, title: title ?? null, locked: false, createdAt: new Date().toISOString() };
    rooms[code] = room;
    writeRooms(rooms);
    return toPublicRoom(room);
  }
  throw new RoomError(RoomErrorCode.UNKNOWN, { reason: 'room-code-exhausted' });
}

export async function getRoom(code) {
  const room = readRooms()[code];
  if (!room) throw new RoomError(RoomErrorCode.NOT_FOUND);
  return toPublicRoom(room);
}

export async function lockRoom(code) {
  const rooms = readRooms();
  const room = rooms[code];
  if (!room) throw new RoomError(RoomErrorCode.NOT_FOUND);
  room.locked = true;
  rooms[code] = room;
  writeRooms(rooms);
  return toPublicRoom(room);
}

function findExistingScore(items, roomCode, normalizedTeamName) {
  return items.find((s) => s.roomCode === roomCode && s.teamName === normalizedTeamName);
}

export async function checkTeamName(code, teamName) {
  const room = readRooms()[code];
  if (!room) throw new RoomError(RoomErrorCode.NOT_FOUND);
  if (room.locked) throw new RoomError(RoomErrorCode.LOCKED);

  const normalized = normalizeTeamName(teamName);
  const { items } = readScoreState();
  const existing = findExistingScore(items, code, normalized);
  if (existing) {
    throw new RoomError(RoomErrorCode.TEAM_TAKEN, {
      score: existing.score,
      createdAt: existing.createdAt,
    });
  }
}

export async function submitScore({ roomCode, teamName, score, note }) {
  const room = readRooms()[roomCode];
  if (!room) throw new RoomError(RoomErrorCode.NOT_FOUND);
  if (room.locked) throw new RoomError(RoomErrorCode.LOCKED);

  const normalized = normalizeTeamName(teamName);
  const state = readScoreState();
  const existing = findExistingScore(state.items, roomCode, normalized);
  if (existing) {
    throw new RoomError(RoomErrorCode.TEAM_TAKEN, {
      score: existing.score,
      createdAt: existing.createdAt,
    });
  }

  const record = {
    id: state.nextId,
    roomCode,
    teamName: normalized,
    score: Number(score),
    note: note ?? null,
    createdAt: new Date().toISOString(),
  };
  state.nextId += 1;
  state.items.push(record);
  writeScoreState(state);

  const publicScore = toPublicScore(record);
  broadcastInsert(roomCode, publicScore);
  return publicScore;
}

export async function listScores(roomCode) {
  const { items } = readScoreState();
  const filtered = items.filter((s) => s.roomCode === roomCode).map(toPublicScore);
  return sortScores(filtered);
}

export function subscribeScores(roomCode, onInsert) {
  if (!localListeners.has(roomCode)) localListeners.set(roomCode, new Set());
  localListeners.get(roomCode).add(onInsert);

  const ch = getChannel();
  const handleMessage = (event) => {
    const msg = event.data;
    if (!msg || msg.type !== 'score:insert' || msg.roomCode !== roomCode) return;
    onInsert(msg.score);
  };
  ch?.addEventListener('message', handleMessage);

  return () => {
    localListeners.get(roomCode)?.delete(onInsert);
    ch?.removeEventListener('message', handleMessage);
  };
}
