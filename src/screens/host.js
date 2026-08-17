import '../styles/rooms.css';
import { RoomErrorCode } from '../net/rooms.js';
import { getHostSession, saveHostRoom, clearHostSession } from './roomSession.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmt(i18n, key, vars) {
  let str = i18n.t(key);
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.split(`{${k}}`).join(String(v));
    });
  }
  return str;
}

function errorMessage(i18n, err) {
  return err?.code === RoomErrorCode.NETWORK
    ? i18n.t('rooms.host.errors.network')
    : i18n.t('rooms.host.errors.unknown');
}

// Stable sort matching rooms.listScores(): score high to low, ties broken by
// whoever submitted first. Used to insert realtime inserts at the right spot
// without needing a full refetch+resort.
function insertScoreSorted(list, score) {
  if (list.some((s) => s.id === score.id)) return; // dedupe replayed inserts
  const idx = list.findIndex(
    (s) => score.score > s.score
      || (score.score === s.score && new Date(score.createdAt) < new Date(s.createdAt)),
  );
  if (idx === -1) list.push(score);
  else list.splice(idx, 0, score);
}

export function createHostScreen(ctx) {
  const { i18n, rooms, router } = ctx;

  const el = document.createElement('div');
  el.className = 'host-screen';
  el.innerHTML = `
    <div class="home-bg" aria-hidden="true"></div>
    <button type="button" class="screen-back" id="rmHostBack"></button>
    <div class="host-card" id="rmHostCard"></div>
  `;

  const backBtn = el.querySelector('#rmHostBack');
  const card = el.querySelector('#rmHostCard');
  backBtn.addEventListener('click', () => router.go('/'));

  // ---- state -------------------------------------------------------
  let phase = 'loading'; // 'loading' | 'create' | 'dashboard'
  let room = null; // { code, title, locked, createdAt }
  let scores = [];
  let creating = false;
  let createError = null;
  let confirmingLock = false;
  let locking = false;
  let lockError = null;
  let copyState = 'idle'; // 'idle' | 'copied'
  let copyTimeout = null;
  let unsubscribeScores = null;

  function teardownSubscription() {
    if (unsubscribeScores) {
      unsubscribeScores();
      unsubscribeScores = null;
    }
  }

  async function enterDashboard(r) {
    room = r;
    phase = 'dashboard';
    scores = [];
    render();

    try {
      scores = await rooms.listScores(room.code);
    } catch {
      scores = [];
    }
    render();

    teardownSubscription();
    unsubscribeScores = rooms.subscribeScores(room.code, (score) => {
      insertScoreSorted(scores, score);
      render();
    });
  }

  async function init() {
    const saved = getHostSession();
    if (!saved?.roomCode) {
      phase = 'create';
      render();
      return;
    }
    phase = 'loading';
    render();
    try {
      const r = await rooms.getRoom(saved.roomCode);
      await enterDashboard(r);
    } catch (err) {
      if (err?.code === RoomErrorCode.NOT_FOUND) {
        // The room the host had open no longer exists (e.g. a fresh local
        // mock after reload) — fall back to letting them open a new one.
        clearHostSession();
      } else {
        createError = err;
      }
      phase = 'create';
      render();
    }
  }

  async function doCreateRoom() {
    creating = true;
    createError = null;
    render();
    try {
      const r = await rooms.createRoom({});
      saveHostRoom(r.code);
      creating = false;
      await enterDashboard(r);
    } catch (err) {
      creating = false;
      createError = err;
      render();
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }

  function doCopy() {
    if (!room) return;
    const text = room.code;
    const finish = () => {
      copyState = 'copied';
      render();
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copyState = 'idle';
        render();
      }, 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(finish).catch(() => {
        if (fallbackCopy(text)) finish();
      });
    } else if (fallbackCopy(text)) {
      finish();
    }
  }

  async function confirmLock() {
    locking = true;
    lockError = null;
    render();
    try {
      const r = await rooms.lockRoom(room.code);
      room = r;
      locking = false;
      confirmingLock = false;
      render();
    } catch (err) {
      locking = false;
      lockError = err;
      render();
    }
  }

  /* ------------------------------------------------------------ render */

  function renderCreatePhase() {
    card.innerHTML = `
      <h1 class="join-title">${escapeHtml(i18n.t('rooms.host.heading'))}</h1>
      <p class="join-subtitle">${escapeHtml(i18n.t('rooms.host.subtitle'))}</p>
      ${createError ? `<div class="form-error">${escapeHtml(errorMessage(i18n, createError))}</div>` : ''}
      <button type="button" class="btn-primary" id="rmCreateBtn" ${creating ? 'disabled' : ''}>
        ${escapeHtml(creating ? i18n.t('rooms.host.creating') : i18n.t('rooms.host.createBtn'))}
      </button>
    `;
    card.querySelector('#rmCreateBtn').addEventListener('click', doCreateRoom);
  }

  function renderLoadingPhase() {
    card.innerHTML = `
      <h1 class="join-title">${escapeHtml(i18n.t('rooms.host.heading'))}</h1>
      <p class="join-subtitle">${escapeHtml(i18n.t('rooms.host.loading'))}</p>
    `;
  }

  function renderDashboardPhase() {
    const rows = scores.map((s, i) => `
      <tr>
        <td class="rm-rank">${i + 1}</td>
        <td class="rm-team">${escapeHtml(s.teamName)}</td>
        <td class="rm-score">${escapeHtml(s.score)}</td>
        <td class="rm-time">${escapeHtml(formatTime(s.createdAt))}</td>
      </tr>
    `).join('');

    card.innerHTML = `
      <div class="rm-room-panel">
        <span class="rm-room-panel-label">${escapeHtml(i18n.t('rooms.host.roomCodeLabel'))}</span>
        <div class="rm-room-code">${escapeHtml(room.code)}</div>
        <div class="rm-room-panel-actions">
          <button type="button" class="btn-ghost" id="rmCopyBtn">
            ${escapeHtml(copyState === 'copied' ? i18n.t('rooms.host.copied') : i18n.t('rooms.host.copyBtn'))}
          </button>
          ${room.locked ? `<span class="rm-locked-badge">${escapeHtml(i18n.t('rooms.host.lockedBadge'))}</span>` : ''}
        </div>
      </div>

      <div class="rm-leaderboard-section">
        <div class="rm-leaderboard-head">
          <span class="rm-teams-count">${escapeHtml(fmt(i18n, 'rooms.host.teamsReported', { count: scores.length }))}</span>
          ${!room.locked ? `<button type="button" class="btn-reset" id="rmLockBtn">${escapeHtml(i18n.t('rooms.host.lockBtn'))}</button>` : ''}
        </div>

        ${scores.length === 0 ? `
          <div class="rm-empty-state">${escapeHtml(i18n.t('rooms.host.empty'))}</div>
        ` : `
          <div class="rm-table-wrap">
            <table class="rm-leaderboard">
              <thead>
                <tr>
                  <th>${escapeHtml(i18n.t('rooms.host.table.rank'))}</th>
                  <th>${escapeHtml(i18n.t('rooms.host.table.team'))}</th>
                  <th>${escapeHtml(i18n.t('rooms.host.table.score'))}</th>
                  <th>${escapeHtml(i18n.t('rooms.host.table.time'))}</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `}
      </div>

      ${confirmingLock ? `
        <div class="rm-confirm-overlay" id="rmConfirmOverlay">
          <div class="rm-confirm-card">
            <h2>${escapeHtml(i18n.t('rooms.host.lockConfirmTitle'))}</h2>
            <p>${escapeHtml(i18n.t('rooms.host.lockConfirmBody'))}</p>
            ${lockError ? `<div class="form-error">${escapeHtml(errorMessage(i18n, lockError))}</div>` : ''}
            <div class="rm-confirm-actions">
              <button type="button" class="btn-ghost" id="rmLockCancel" ${locking ? 'disabled' : ''}>
                ${escapeHtml(i18n.t('rooms.host.lockConfirmCancel'))}
              </button>
              <button type="button" class="btn-primary" id="rmLockConfirm" ${locking ? 'disabled' : ''}>
                ${escapeHtml(locking ? i18n.t('rooms.host.locking') : i18n.t('rooms.host.lockConfirmConfirm'))}
              </button>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    card.querySelector('#rmCopyBtn')?.addEventListener('click', doCopy);
    card.querySelector('#rmLockBtn')?.addEventListener('click', () => {
      confirmingLock = true;
      lockError = null;
      render();
    });

    const overlay = card.querySelector('#rmConfirmOverlay');
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay && !locking) {
        confirmingLock = false;
        render();
      }
    });
    card.querySelector('#rmLockCancel')?.addEventListener('click', () => {
      if (locking) return;
      confirmingLock = false;
      render();
    });
    card.querySelector('#rmLockConfirm')?.addEventListener('click', confirmLock);
  }

  function render() {
    backBtn.textContent = i18n.t('mode.back');
    if (phase === 'create') renderCreatePhase();
    else if (phase === 'loading') renderLoadingPhase();
    else if (phase === 'dashboard') renderDashboardPhase();
  }

  // Subscribed once for the app's lifetime — i18n has no unsubscribe, so
  // this must stay a harmless repaint of whatever state is current.
  i18n.onChange(() => render());

  function onEnter() {
    init();
  }

  function onLeave() {
    teardownSubscription();
    if (copyTimeout) {
      clearTimeout(copyTimeout);
      copyTimeout = null;
    }
    confirmingLock = false;
    lockError = null;
  }

  return { el, onEnter, onLeave };
}
