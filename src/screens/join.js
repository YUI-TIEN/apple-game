import '../styles/rooms.css';
import {
  normalizeRoomCode,
  validateJoinInput,
  TEAM_NAME_MAX,
} from '../app/validation.js';
import { RoomErrorCode } from '../net/rooms.js';
import {
  getPlayerSession,
  saveJoin,
  savePendingScore,
  markSubmitted,
  clearPlayerSession,
} from './roomSession.js';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// hh:mm in the device's local time — teams and the host are in the same
// room, so there is no timezone to reconcile.
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

function mapPreJoinError(err) {
  switch (err?.code) {
    case RoomErrorCode.NOT_FOUND:
      return { key: 'rooms.join.errors.notFound' };
    case RoomErrorCode.LOCKED:
      return { key: 'rooms.join.errors.locked' };
    case RoomErrorCode.TEAM_TAKEN: {
      const { score, createdAt } = err.details || {};
      return { key: 'rooms.join.errors.teamTaken', vars: { score, time: formatTime(createdAt) } };
    }
    case RoomErrorCode.NETWORK:
      return { key: 'rooms.join.errors.network' };
    default:
      return { key: 'rooms.join.errors.unknown' };
  }
}

export function createJoinScreen(ctx) {
  const { i18n, rooms, game, screens, router } = ctx;

  const el = document.createElement('div');
  el.className = 'join-screen';
  el.innerHTML = `
    <div class="home-bg" aria-hidden="true"></div>
    <button type="button" class="screen-back" id="rmJoinBack"></button>
    <div class="join-card" id="rmJoinCard"></div>
  `;

  const backBtn = el.querySelector('#rmJoinBack');
  const card = el.querySelector('#rmJoinCard');
  backBtn.addEventListener('click', () => router.go('/'));

  // ---- state -------------------------------------------------------
  let phase = 'form'; // 'form' | 'already' | 'pendingUpload'
  let roomVal = '';
  let teamVal = '';
  let formErrorKey = null;
  let formErrorVars = null;
  let submitting = false;
  let formRefs = null;

  // Upload widget state, shared by the post-game result card and the
  // "resume an unsent score after reload" card — same states, different
  // mount point.
  let uploadState = 'idle'; // 'idle' | 'error' | 'taken' | 'locked' | 'success'
  let uploadErrorInfo = null;
  let uploading = false;

  function resetToForm(prefill) {
    phase = 'form';
    formErrorKey = null;
    formErrorVars = null;
    formRefs = null;
    if (prefill) {
      const s = getPlayerSession();
      roomVal = s?.roomCode || '';
      teamVal = s?.teamName || '';
    } else {
      roomVal = '';
      teamVal = '';
    }
  }

  /* ------------------------------------------------------ form phase */

  function renderFormPhase() {
    card.innerHTML = `
      <h1 class="join-title">${escapeHtml(i18n.t('rooms.join.heading'))}</h1>
      <p class="join-subtitle">${escapeHtml(i18n.t('rooms.join.subtitle'))}</p>
      <form novalidate id="rmForm">
        <div class="field">
          <label class="field-label" for="rmRoom">${escapeHtml(i18n.t('rooms.join.roomLabel'))}</label>
          <input id="rmRoom" class="field-input room-input" type="text" autocomplete="off"
                 autocapitalize="characters" spellcheck="false" maxlength="12" />
          <span class="field-hint">${escapeHtml(i18n.t('rooms.join.roomHint'))}</span>
        </div>
        <div class="field">
          <label class="field-label" for="rmTeam">${escapeHtml(i18n.t('rooms.join.teamLabel'))}</label>
          <input id="rmTeam" class="field-input" type="text" maxlength="40" />
          <span class="field-hint" id="rmCounter"></span>
        </div>
        <div class="form-error hidden" id="rmFormError"></div>
        <button type="submit" class="btn-primary" id="rmSubmitBtn"></button>
      </form>
    `;

    const form = card.querySelector('#rmForm');
    const roomInput = card.querySelector('#rmRoom');
    const teamInput = card.querySelector('#rmTeam');
    const counter = card.querySelector('#rmCounter');
    const errorBox = card.querySelector('#rmFormError');
    const submitBtn = card.querySelector('#rmSubmitBtn');

    roomInput.value = roomVal;
    teamInput.value = teamVal;

    const updateCounter = () => {
      counter.textContent = `${teamVal.length}/${TEAM_NAME_MAX}`;
    };
    const updateError = () => {
      if (formErrorKey) {
        errorBox.textContent = fmt(i18n, formErrorKey, formErrorVars);
        errorBox.classList.remove('hidden');
      } else {
        errorBox.textContent = '';
        errorBox.classList.add('hidden');
      }
    };
    const updateSubmit = () => {
      submitBtn.disabled = submitting;
      submitBtn.textContent = submitting ? i18n.t('rooms.join.checking') : i18n.t('rooms.join.submit');
    };

    updateCounter();
    updateError();
    updateSubmit();

    // Room codes arrive pasted, lower-cased, or with stray spaces from chat
    // apps — normalize live but never silently swap confusable characters.
    roomInput.addEventListener('input', () => {
      const start = roomInput.selectionStart;
      const before = roomInput.value;
      const after = normalizeRoomCode(before);
      if (after !== before) {
        roomInput.value = after;
        const delta = before.length - after.length;
        const pos = Math.max(0, start - delta);
        roomInput.setSelectionRange(pos, pos);
      }
      roomVal = roomInput.value;
      if (formErrorKey) {
        formErrorKey = null;
        formErrorVars = null;
        updateError();
      }
    });

    teamInput.addEventListener('input', () => {
      teamVal = teamInput.value;
      updateCounter();
      if (formErrorKey) {
        formErrorKey = null;
        formErrorVars = null;
        updateError();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (submitting) return;
      attemptJoin();
    });

    formRefs = { roomInput, teamInput, updateError, updateSubmit };
  }

  async function attemptJoin() {
    const result = validateJoinInput(roomVal, teamVal);
    if (result.error) {
      formErrorKey = result.error;
      formErrorVars = null;
      formRefs?.updateError();
      const target = result.error.startsWith('join.errors.room') ? formRefs?.roomInput : formRefs?.teamInput;
      target?.focus();
      return;
    }

    submitting = true;
    formErrorKey = null;
    formErrorVars = null;
    formRefs?.updateError();
    formRefs?.updateSubmit();

    try {
      await rooms.checkTeamName(result.room, result.team);
      submitting = false;
      roomVal = result.room;
      teamVal = result.team;
      saveJoin(result.room, result.team);
      startTeamRound(result.room, result.team);
    } catch (err) {
      submitting = false;
      const mapped = mapPreJoinError(err);
      formErrorKey = mapped.key;
      formErrorVars = mapped.vars || null;
      formRefs?.updateError();
      formRefs?.updateSubmit();
    }
  }

  function startTeamRound(room, team) {
    uploadState = 'idle';
    uploadErrorInfo = null;
    uploading = false;
    game.setMode('team');
    game.onEnd((score) => {
      savePendingScore(room, team, score);
      paintUpload(game.resultExtra, room, team, score);
    });
    screens.show('game');
    game.start();
  }

  /* ---------------------------------------------------- already phase */

  function renderAlreadyPhase() {
    const s = getPlayerSession();
    card.innerHTML = `
      <h1 class="join-title">${escapeHtml(i18n.t('rooms.join.already.heading'))}</h1>
      <p class="join-subtitle">${escapeHtml(fmt(i18n, 'rooms.join.already.body', {
        name: s?.teamName || '',
        score: s?.score ?? '',
        time: formatTime(s?.submittedAt),
      }))}</p>
      <button type="button" class="btn-ghost" id="rmChangeTeam">${escapeHtml(i18n.t('rooms.join.changeTeam'))}</button>
    `;
    card.querySelector('#rmChangeTeam').addEventListener('click', () => {
      clearPlayerSession();
      resetToForm(false);
      render();
    });
  }

  /* ----------------------------------------------- pending upload phase */

  function renderPendingUploadPhase() {
    const s = getPlayerSession();
    const room = s?.roomCode;
    const team = s?.teamName;
    const score = s?.pendingScore;

    card.innerHTML = `
      <h1 class="join-title">${escapeHtml(i18n.t('rooms.join.result.heading'))}</h1>
      <p class="join-subtitle">${escapeHtml(i18n.t('rooms.join.result.resumeHint'))}</p>
      <div class="rm-score-display">
        <span class="rm-score-label">${escapeHtml(i18n.t('rooms.join.result.scoreLabel'))}</span>
        <span class="rm-score-value">${escapeHtml(score)}</span>
      </div>
      <div id="rmPendingUploadSlot"></div>
    `;

    uploadState = 'idle';
    uploadErrorInfo = null;
    uploading = false;
    paintUpload(card.querySelector('#rmPendingUploadSlot'), room, team, score);
  }

  /* --------------------------------------------------------- upload UI */
  // Shared by the game-screen result card (game.resultExtra) and the
  // pending-upload phase above; only the mount point differs.

  function buildUploadHtml(score) {
    if (uploadState === 'success') {
      return `<p class="rm-upload-note rm-upload-success">${escapeHtml(i18n.t('rooms.join.result.uploaded'))}</p>`;
    }
    if (uploadState === 'locked') {
      return `<p class="rm-upload-note rm-upload-locked">${escapeHtml(
        fmt(i18n, 'rooms.join.result.errors.locked', { score }),
      )}</p>`;
    }
    if (uploadState === 'taken') {
      const { score: existingScore, createdAt } = uploadErrorInfo?.details || {};
      return `<p class="rm-upload-note rm-upload-taken">${escapeHtml(
        fmt(i18n, 'rooms.join.result.errors.teamTaken', { score: existingScore, time: formatTime(createdAt) }),
      )}</p>`;
    }
    const errorHtml = uploadState === 'error'
      ? `<div class="form-error">${escapeHtml(i18n.t(
        uploadErrorInfo?.code === RoomErrorCode.NETWORK
          ? 'rooms.join.result.errors.network'
          : 'rooms.join.result.errors.unknown',
      ))}</div>`
      : '';
    return `
      ${errorHtml}
      <button type="button" class="btn-primary" id="rmUploadBtn" ${uploading ? 'disabled' : ''}>
        ${escapeHtml(uploading ? i18n.t('rooms.join.result.uploading') : i18n.t('rooms.join.result.uploadBtn'))}
      </button>
    `;
  }

  function paintUpload(container, room, team, score) {
    if (!container) return;
    container.innerHTML = buildUploadHtml(score);
    const btn = container.querySelector('#rmUploadBtn');
    if (btn) btn.addEventListener('click', () => doUpload(container, room, team, score));
  }

  async function doUpload(container, room, team, score) {
    uploading = true;
    paintUpload(container, room, team, score);
    try {
      const saved = await rooms.submitScore({ roomCode: room, teamName: team, score });
      uploading = false;
      uploadState = 'success';
      markSubmitted(room, team, saved?.score ?? score, saved?.createdAt ?? new Date().toISOString());
      paintUpload(container, room, team, score);
    } catch (err) {
      uploading = false;
      if (err?.code === RoomErrorCode.TEAM_TAKEN) {
        uploadState = 'taken';
        uploadErrorInfo = err;
        // A conflict here most likely means an earlier attempt actually
        // landed even though the client didn't see the response — treat it
        // as converged, not as a fresh failure, so retries can't double-write.
        const { score: existingScore, createdAt } = err.details || {};
        markSubmitted(room, team, existingScore, createdAt);
      } else if (err?.code === RoomErrorCode.LOCKED) {
        uploadState = 'locked';
        uploadErrorInfo = err;
      } else {
        uploadState = 'error';
        uploadErrorInfo = err;
      }
      paintUpload(container, room, team, score);
    }
  }

  /* ------------------------------------------------------------ render */

  function render() {
    backBtn.textContent = i18n.t('mode.back');
    if (phase === 'form') renderFormPhase();
    else if (phase === 'already') renderAlreadyPhase();
    else if (phase === 'pendingUpload') renderPendingUploadPhase();
  }

  // Subscribed once for the lifetime of the app (i18n has no unsubscribe),
  // so this must not accumulate per-mount state — it just repaints whatever
  // phase is current, harmlessly, even while this screen is hidden.
  i18n.onChange(() => render());

  function onEnter() {
    const s = getPlayerSession();
    if (s?.pendingScore != null && s.roomCode && s.teamName) {
      phase = 'pendingUpload';
    } else if (s?.submitted && s.roomCode && s.teamName) {
      phase = 'already';
    } else {
      resetToForm(true);
    }
    render();
  }

  function onLeave() {
    // No timers or realtime subscriptions live on this screen — the upload
    // widget's own async work is safe to let finish in the background even
    // if it's mounted inside the (now active) game screen's result card.
  }

  return { el, onEnter, onLeave };
}
