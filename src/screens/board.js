import '../styles/rooms.css';
import { normalizeRoomCode } from '../app/validation.js';
import { RoomErrorCode } from '../net/rooms.js';
import { getHostSession, getPlayerSession } from './roomSession.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function errorMessage(i18n, err) {
  if (err?.code === RoomErrorCode.NOT_FOUND) return i18n.t('rooms.board.errors.notFound');
  if (err?.code === RoomErrorCode.NETWORK) return i18n.t('rooms.board.errors.network');
  return i18n.t('rooms.board.errors.unknown');
}

// Same ordering rule as rooms.listScores(): score high to low, ties broken
// by earliest submission. Lets realtime inserts land in the right spot
// without a full refetch.
function insertScoreSorted(list, score) {
  if (list.some((s) => s.id === score.id)) return;
  const idx = list.findIndex(
    (s) => score.score > s.score
      || (score.score === s.score && new Date(score.createdAt) < new Date(s.createdAt)),
  );
  if (idx === -1) list.push(score);
  else list.splice(idx, 0, score);
}

export function createBoardScreen(ctx) {
  const { i18n, rooms } = ctx;

  const el = document.createElement('div');
  el.className = 'board-screen';
  el.innerHTML = `
    <div class="board-inner" id="rmBoardInner"></div>
  `;

  const inner = el.querySelector('#rmBoardInner');

  let phase = 'noRoom'; // 'noRoom' | 'loading' | 'ready' | 'error'
  let roomCode = null;
  let scores = [];
  let loadError = null;
  let unsubscribeScores = null;

  function teardownSubscription() {
    if (unsubscribeScores) {
      unsubscribeScores();
      unsubscribeScores = null;
    }
  }

  // Priority: explicit ?room= query string, then whichever room this device
  // most recently hosted, then whichever room this device most recently
  // played in. A projector is normally opened by the host right after
  // opening /host, so the host session is the more useful fallback.
  function resolveRoomCode() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room');
    if (fromQuery) return normalizeRoomCode(fromQuery);
    const host = getHostSession();
    if (host?.roomCode) return host.roomCode;
    const player = getPlayerSession();
    if (player?.roomCode) return player.roomCode;
    return null;
  }

  async function init() {
    teardownSubscription();
    roomCode = resolveRoomCode();
    if (!roomCode) {
      phase = 'noRoom';
      render();
      return;
    }
    phase = 'loading';
    render();
    try {
      await rooms.getRoom(roomCode);
      scores = await rooms.listScores(roomCode);
      phase = 'ready';
      render();
      unsubscribeScores = rooms.subscribeScores(roomCode, (score) => {
        insertScoreSorted(scores, score);
        render();
      });
    } catch (err) {
      loadError = err;
      phase = 'error';
      render();
    }
  }

  function render() {
    if (phase === 'noRoom') {
      inner.innerHTML = `<div class="board-empty">${escapeHtml(i18n.t('rooms.board.needRoom'))}</div>`;
      return;
    }
    if (phase === 'loading') {
      inner.innerHTML = `<div class="board-empty">${escapeHtml(i18n.t('rooms.board.loading'))}</div>`;
      return;
    }
    if (phase === 'error') {
      inner.innerHTML = `<div class="board-empty">${escapeHtml(errorMessage(i18n, loadError))}</div>`;
      return;
    }

    if (scores.length === 0) {
      inner.innerHTML = `
        <div class="board-room-code">${escapeHtml(roomCode)}</div>
        <div class="board-empty">${escapeHtml(i18n.t('rooms.board.empty'))}</div>
      `;
      return;
    }

    const rows = scores.map((s, i) => `
      <tr class="board-row${i < 3 ? ` board-row-top board-row-rank${i + 1}` : ''}">
        <td class="board-rank">${i + 1}</td>
        <td class="board-team">${escapeHtml(s.teamName)}</td>
        <td class="board-score">${escapeHtml(s.score)}</td>
      </tr>
    `).join('');

    inner.innerHTML = `
      <div class="board-room-code">${escapeHtml(roomCode)}</div>
      <table class="board-table">
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function onEnter() {
    init();
  }

  function onLeave() {
    teardownSubscription();
  }

  return { el, onEnter, onLeave };
}
