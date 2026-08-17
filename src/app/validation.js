// Shared input rules for room codes and team names.
//
// Room codes are read out loud to a room full of people, so the alphabet drops
// every glyph pair that gets misheard or miscopied: 0/O, 1/I/L.

export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TEAM_NAME_MAX = 20;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`);
const ROOM_CODE_CONFUSABLE = /[01OIL]/;

export function normalizeRoomCode(raw) {
  return (raw || '').replace(/\s+/g, '').toUpperCase();
}

// Must match the normalization the database applies, or "A隊" and "A隊 " slip
// past the unique constraint as two different teams.
export function normalizeTeamName(raw) {
  return (raw || '').trim().replace(/\s+/g, ' ');
}

// Returns an i18n key for the first problem found, or null when the pair is
// well-formed. Existence, lock state and duplicate team names are server-side
// checks and are not decided here.
export function validateJoinInput(rawRoom, rawTeam) {
  const room = normalizeRoomCode(rawRoom);
  const team = normalizeTeamName(rawTeam);

  if (!room) return { error: 'join.errors.roomRequired' };
  if (ROOM_CODE_CONFUSABLE.test(room)) return { error: 'join.errors.roomConfusable' };
  if (room.length !== ROOM_CODE_LENGTH || !ROOM_CODE_PATTERN.test(room)) {
    return { error: 'join.errors.roomFormat' };
  }
  if (!team) return { error: 'join.errors.teamRequired' };
  if (team.length > TEAM_NAME_MAX) return { error: 'join.errors.teamTooLong' };

  return { room, team };
}
