// Local persistence for the room flow.
//
// Two independent slices live here:
//  - "player" — which room/team a player joined, and whether that team
//    already has a score on the server. A refresh or dropped connection
//    should not force re-entry, and an already-submitted team should not be
//    able to start a second round just because the tab reloaded.
//  - "host" — which room a host created, so a host refresh returns to the
//    same room instead of minting a new one.
//
// This is a convenience cache, not a source of truth. Every guard it enables
// (skip the join form, block a second round) is re-checked against the
// server (checkTeamName / submitScore) before anything is written. Losing
// this storage — private browsing, cleared storage, a different device —
// only means falling back to the plain join form or a fresh room.

const PLAYER_KEY = 'appleGameRoomPlayer';
const HOST_KEY = 'appleGameRoomHost';

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full — the session just won't persist */
  }
}

/* ------------------------------------------------------------- player */

// Shape: { roomCode, teamName, submitted, score, submittedAt, pendingScore }
export function getPlayerSession() {
  return readJSON(PLAYER_KEY);
}

// Records which room/team the player is in. A different room or team name
// than what was stored starts a clean slate so a stale "submitted" flag from
// a previous team never leaks onto the new one.
export function saveJoin(roomCode, teamName) {
  const prev = getPlayerSession();
  if (prev && prev.roomCode === roomCode && prev.teamName === teamName) {
    writeJSON(PLAYER_KEY, { ...prev, roomCode, teamName });
    return;
  }
  writeJSON(PLAYER_KEY, { roomCode, teamName });
}

// A round just ended but the score has not been confirmed uploaded yet.
// Kept so a reload between "time's up" and a successful upload can resume
// the upload instead of losing the score.
export function savePendingScore(roomCode, teamName, score) {
  const session = getPlayerSession() || {};
  writeJSON(PLAYER_KEY, { ...session, roomCode, teamName, pendingScore: score });
}

export function markSubmitted(roomCode, teamName, score, submittedAt) {
  const session = getPlayerSession() || {};
  const next = { ...session, roomCode, teamName, submitted: true, score, submittedAt };
  delete next.pendingScore;
  writeJSON(PLAYER_KEY, next);
}

export function clearPlayerSession() {
  writeJSON(PLAYER_KEY, null);
}

/* --------------------------------------------------------------- host */

// Shape: { roomCode }
export function getHostSession() {
  return readJSON(HOST_KEY);
}

export function saveHostRoom(roomCode) {
  writeJSON(HOST_KEY, { roomCode });
}

export function clearHostSession() {
  writeJSON(HOST_KEY, null);
}
