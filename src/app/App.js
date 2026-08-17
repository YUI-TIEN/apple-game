import { Router } from './router.js';
import { ScreenManager } from './screens.js';
import { Game } from '../game/Game.js';
import { HeroItems } from '../game/HeroItems.js';
import { i18n } from '../i18n/i18n.js';
import * as rooms from '../net/rooms.js';
import { createJoinScreen } from '../screens/join.js';
import { createHostScreen } from '../screens/host.js';
import { createBoardScreen } from '../screens/board.js';

const LAST_MODE_KEY = 'bakeryLastMode';

export class App {
  constructor() {
    this.screens = new ScreenManager();
    this.router = new Router(
      {
        '/': 'mode',
        '/solo': 'solo',
        '/join': 'join',
        '/host': 'host',
        '/board': 'board',
      },
      { fallback: '/' },
    );

    this.game = new Game();
    this.hero = new HeroItems(document.getElementById('heroCanvas'));
    this.heroFrame = null;
    this.globalLang = document.getElementById('globalLang');

    // Everything a room screen is allowed to reach. Screens get the app's
    // collaborators injected rather than importing them, so they stay testable
    // and cannot quietly grab hold of the DOM outside their own element.
    this.screenContext = {
      rooms,
      i18n,
      router: this.router,
      screens: this.screens,
      game: this.game,
    };

    this.setupLanguageSwitcher();
    this.registerScreens();
    this.registerRoomScreens();
    this.setupBackButtons();
    this.setupModeScreen();
    this.setupSoloScreen();

    i18n.onChange(() => i18n.applyToDOM());
    i18n.applyToDOM();

    this.router.onNavigate((screen) => this.screens.show(screen));
    this.router.start();
  }

  /* -------------------------------------------------------------- screens */

  registerScreens() {
    this.screens.register('mode', {
      el: document.getElementById('modeScreen'),
      onEnter: () => this.markLastMode(),
    });

    this.screens.register('solo', {
      el: document.getElementById('homeScreen'),
      onEnter: () => this.startHero(),
      onLeave: () => this.stopHero(),
    });

    this.screens.register('game', {
      el: document.querySelector('.game-container'),
      onEnter: () => {
        this.globalLang.classList.add('hidden');
        this.game.enter();
      },
      onLeave: () => {
        this.globalLang.classList.remove('hidden');
        this.game.leave();
      },
    });
  }

  registerRoomScreens() {
    [
      ['join', createJoinScreen],
      ['host', createHostScreen],
      ['board', createBoardScreen],
    ].forEach(([name, factory]) => {
      const screen = factory(this.screenContext);
      if (name === 'board') {
        const { onEnter, onLeave } = screen;
        screen.onEnter = () => {
          this.globalLang.classList.add('hidden');
          onEnter?.();
        };
        screen.onLeave = () => {
          onLeave?.();
          this.globalLang.classList.remove('hidden');
        };
      }
      document.body.appendChild(screen.el);
      this.screens.register(name, screen);
    });
  }

  setupBackButtons() {
    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => this.router.go('/'));
    });
  }

  /* ----------------------------------------------------------------- mode */

  setupModeScreen() {
    document.getElementById('modeSoloBtn').addEventListener('click', () => {
      this.rememberMode('solo');
      this.router.go('/solo');
    });

    document.getElementById('modeMultiBtn').addEventListener('click', () => {
      this.rememberMode('multi');
      this.router.go('/join');
    });

    document.getElementById('modeHostBtn').addEventListener('click', () => {
      this.router.go('/host');
    });
  }

  rememberMode(mode) {
    try {
      localStorage.setItem(LAST_MODE_KEY, mode);
    } catch {
      /* private mode — the badge is a nicety, not a requirement */
    }
  }

  lastMode() {
    try {
      return localStorage.getItem(LAST_MODE_KEY);
    } catch {
      return null;
    }
  }

  // Marks the mode played last time so a repeat visitor can re-enter in one tap.
  markLastMode() {
    const last = this.lastMode();
    const cards = {
      solo: document.getElementById('modeSoloBtn'),
      multi: document.getElementById('modeMultiBtn'),
    };

    Object.entries(cards).forEach(([mode, card]) => {
      const isLast = mode === last;
      card.classList.toggle('is-last', isLast);
      card.querySelector('.mode-card-badge').classList.toggle('hidden', !isLast);
    });

    if (cards[last]) cards[last].focus({ preventScroll: true });
  }

  /* ----------------------------------------------------------------- solo */

  setupSoloScreen() {
    document.getElementById('startBtn').addEventListener('click', () => {
      this.game.setMode('solo');
      this.screens.show('game');
      this.game.start();
    });
  }

  startHero() {
    this.hero.resize();
    const tick = () => {
      this.hero.update();
      this.hero.draw();
      this.heroFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  stopHero() {
    if (this.heroFrame) cancelAnimationFrame(this.heroFrame);
    this.heroFrame = null;
  }

  /* ------------------------------------------------------------- language */

  setupLanguageSwitcher() {
    const select = document.getElementById('langSelect');
    select.innerHTML = i18n
      .availableLocales()
      .map(({ code, name }) => `<option value="${code}">${name}</option>`)
      .join('');
    select.value = i18n.locale;
    select.addEventListener('change', (e) => i18n.setLocale(e.target.value));
    i18n.onChange((locale) => { select.value = locale; });
  }
}
