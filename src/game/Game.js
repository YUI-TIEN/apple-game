import { Apple } from './Apple.js';
import { Particle, spawnBurst } from './Particle.js';
import { Background } from './Background.js';
import { drawApple } from './renderApple.js';
import { HeroApples } from './HeroApples.js';
import { i18n } from '../i18n/i18n.js';

const APPLE_RADIUS = 26;
const BUFFER = 10;
const TOTAL_APPLES = 30;
const GAME_DURATION = 60;

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.apples = [];
    this.particles = [];
    this.background = new Background();
    this.score = 0;
    this.isDrawing = false;
    this.currentPath = [];
    this.dpr = window.devicePixelRatio || 1;

    this.state = 'INTRO';
    this.timeLeft = GAME_DURATION;
    this.timerInterval = null;

    this.scoreEl = document.getElementById('scoreValue');
    this.timerEl = document.getElementById('timerValue');
    this.timerDisplay = document.querySelector('.timer-display');
    this.resetBtn = document.getElementById('resetBtn');
    this.lightModeToggle = document.getElementById('lightModeToggle');

    this.homeScreen = document.getElementById('homeScreen');
    this.gameContainer = document.querySelector('.game-container');
    this.heroCanvas = document.getElementById('heroCanvas');
    this.hero = new HeroApples(this.heroCanvas);
    this.messageOverlay = document.getElementById('messageOverlay');
    this.messageTitle = document.getElementById('messageTitle');

    this.finalScoreEl = document.getElementById('finalScore');
    this.bestScoreEl = document.getElementById('bestScore');
    this.newRecordBadge = document.getElementById('newRecordBadge');

    this.startBtn = document.getElementById('startBtn');
    this.playAgainBtn = document.getElementById('playAgainBtn');

    this.countdownOverlay = document.getElementById('countdownOverlay');
    this.countdownValue = document.getElementById('countdownValue');

    this.highScore = parseInt(localStorage.getItem('appleGameHighScore')) || 0;
    this.comboCount = 0;
    this.floatingTexts = [];

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindEvents();
    this.startBackgroundLoop();
  }

  startBackgroundLoop() {
    const tick = () => {
      if (this.state === 'INTRO') {
        this.hero.update();
        this.hero.draw();
      } else {
        this.background.update();
        if (this.state === 'FINISHED') this.draw();
      }
      requestAnimationFrame(tick);
    };
    tick();
  }

  resize() {
    this.hero.resize();
    if (this.gameContainer.classList.contains('hidden')) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  bindEvents() {
    const start = (e) => this.handleInputStart(e);
    const move = (e) => this.handleInputMove(e);
    const end = (e) => this.handleInputEnd(e);

    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);

    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e.touches[0]); }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e.touches[0]); }, { passive: false });
    window.addEventListener('touchend', end);

    this.startBtn.addEventListener('click', () => this.startGame());
    this.resetBtn.addEventListener('click', () => this.startGame());
    this.playAgainBtn.addEventListener('click', () => this.startGame());
    this.lightModeToggle.addEventListener('change', (e) => {
      document.body.classList.toggle('light-mode', e.target.checked);
    });
  }

  startGame() {
    this.homeScreen.classList.add('hidden');
    this.gameContainer.classList.remove('hidden');
    this.messageOverlay.classList.add('hidden');
    this.messageOverlay.classList.remove('visible');
    this.resize();
    this.startCountdown();
  }

  startCountdown() {
    this.state = 'COUNTDOWN';
    this.score = 0;
    this.comboCount = 0;
    this.timeLeft = GAME_DURATION;
    this.updateScore(0);
    this.updateTimerDisplay();
    this.timerDisplay.classList.remove('low-time');

    this.apples = [];
    this.particles = [];
    this.floatingTexts = [];
    this.generateApples();

    this.countdownOverlay.classList.remove('hidden');

    let count = 3;
    this.renderCountdown(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.renderCountdown(count);
      } else {
        clearInterval(interval);
        this.countdownOverlay.classList.add('hidden');
        this.beginPlay();
      }
    }, 700);
  }

  renderCountdown(count) {
    this.countdownValue.textContent = count > 0 ? count : i18n.t('countdown.go');
    this.countdownValue.style.animation = 'none';
    void this.countdownValue.offsetHeight;
    this.countdownValue.style.animation = null;
  }

  beginPlay() {
    this.state = 'PLAYING';
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    this.loop();
  }

  updateTimer() {
    this.timeLeft--;
    this.updateTimerDisplay();

    if (this.timeLeft <= 10) {
      this.timerDisplay.classList.add('low-time');
    }

    if (this.timeLeft <= 0) {
      this.endGame();
    }
  }

  updateTimerDisplay() {
    this.timerEl.textContent = this.timeLeft;
  }

  endGame() {
    this.state = 'FINISHED';
    clearInterval(this.timerInterval);

    const isNewRecord = this.score > this.highScore;
    if (isNewRecord) {
      this.highScore = this.score;
      localStorage.setItem('appleGameHighScore', this.highScore);
    }

    this.messageTitle.textContent = i18n.t('result.timeUp');
    this.finalScoreEl.textContent = this.score;
    this.bestScoreEl.textContent = this.highScore;

    if (isNewRecord && this.score > 0) {
      this.newRecordBadge.classList.remove('hidden');
    } else {
      this.newRecordBadge.classList.add('hidden');
    }

    this.messageOverlay.classList.remove('hidden');
    this.messageOverlay.classList.add('visible');
  }

  generateApples() {
    this.apples = [];
    let attempts = 0;
    while (this.apples.length < TOTAL_APPLES && attempts < 1000) {
      attempts++;
      const apple = this.tryPlaceApple();
      if (apple) this.apples.push(apple);
    }
  }

  tryPlaceApple() {
    const x = Math.random() * (this.width - 2 * (APPLE_RADIUS + BUFFER)) + (APPLE_RADIUS + BUFFER);
    const y = Math.random() * (this.height - 2 * (APPLE_RADIUS + BUFFER)) + (APPLE_RADIUS + BUFFER);

    for (const apple of this.apples) {
      if (apple.removed) continue;
      const dist = Math.hypot(apple.x - x, apple.y - y);
      if (dist < APPLE_RADIUS * 2 + BUFFER) return null;
    }

    const value = Math.floor(Math.random() * 9) + 1;
    return new Apple(x, y, value);
  }

  handleInputStart(e) {
    if (this.state !== 'PLAYING') return;
    const pos = this.getPos(e);
    this.isDrawing = true;
    this.currentPath = [pos];
  }

  handleInputMove(e) {
    if (!this.isDrawing || this.state !== 'PLAYING') return;
    const pos = this.getPos(e);
    const last = this.currentPath[this.currentPath.length - 1];
    const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
    if (dist > 5) {
      this.currentPath.push(pos);
      this.checkRealTimeSelection();
    }
  }

  handleInputEnd() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.checkSelection();
    this.currentPath = [];
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  checkRealTimeSelection() {
    if (this.currentPath.length < 3) {
      this.apples.forEach((a) => (a.selected = false));
      return;
    }
    for (const apple of this.apples) {
      if (apple.removed) continue;
      apple.selected = this.isPointInPolygon(apple, this.currentPath);
    }
  }

  checkSelection() {
    if (this.currentPath.length < 3) return;

    const selectedApples = this.apples.filter((a) => a.selected && !a.removed);
    const sum = selectedApples.reduce((acc, apple) => acc + apple.value, 0);

    if (sum === 10 && selectedApples.length > 0) {
      selectedApples.forEach((apple) => {
        apple.startPop();
        spawnParticlesFor(this.particles, apple);
      });
      this.comboCount++;
      this.spawnFloatingScore(selectedApples);
      this.updateScore(selectedApples.length);
      setTimeout(() => this.checkRefill(), 260);
    } else {
      this.comboCount = 0;
    }

    this.apples.forEach((a) => (a.selected = false));
  }

  spawnFloatingScore(selectedApples) {
    const cx = selectedApples.reduce((s, a) => s + a.x, 0) / selectedApples.length;
    const cy = selectedApples.reduce((s, a) => s + a.y, 0) / selectedApples.length;
    this.floatingTexts.push({
      x: cx,
      y: cy,
      text: `+${selectedApples.length}`,
      life: 1,
      vy: -0.8,
    });
  }

  isPointInPolygon(point, vs) {
    const x = point.x;
    const y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].x;
      const yi = vs[i].y;
      const xj = vs[j].x;
      const yj = vs[j].y;
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  checkRefill() {
    this.apples = this.apples.filter((a) => !a.removed);
    const needed = TOTAL_APPLES - this.apples.length;
    if (needed > 0) this.spawnNewApples(needed);
  }

  spawnNewApples(count) {
    let attempts = 0;
    let added = 0;
    while (added < count && attempts < 500) {
      attempts++;
      const apple = this.tryPlaceApple();
      if (apple) {
        apple.scale = 0;
        this.apples.push(apple);
        added++;
      }
    }
  }

  updateScore(points) {
    if (points === 0) this.score = 0;
    else this.score += points;
    this.scoreEl.textContent = this.score;
  }

  loop() {
    if (this.state !== 'PLAYING') return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  update() {
    this.apples.forEach((apple) => apple.update());
    this.particles.forEach((p) => p.update());
    this.particles = this.particles.filter((p) => p.life > 0);
    this.floatingTexts.forEach((t) => {
      t.y += t.vy;
      t.life -= 0.02;
    });
    this.floatingTexts = this.floatingTexts.filter((t) => t.life > 0);
  }

  renderStatic() {
    this.draw();
  }

  draw() {
    const isLight = document.body.classList.contains('light-mode');
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.background.draw(this.ctx, this.width, this.height, isLight);

    this.apples.forEach((apple) => {
      if (apple.removed) return;
      drawApple(this.ctx, apple);
    });

    this.particles.forEach((p) => p.draw(this.ctx));

    this.drawFloatingTexts();
    this.drawPath();
  }

  drawFloatingTexts() {
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.font = '800 22px "Outfit", sans-serif';
    this.floatingTexts.forEach((t) => {
      this.ctx.globalAlpha = Math.max(0, t.life);
      this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
      this.ctx.fillText(t.text, t.x, t.y);
    });
    this.ctx.restore();
  }

  drawPath() {
    if (this.currentPath.length <= 1) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--line-color').trim();
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = getComputedStyle(document.body).getPropertyValue('--line-color').trim();
    ctx.shadowBlur = 8;
    ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
    for (let i = 1; i < this.currentPath.length; i++) {
      ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function spawnParticlesFor(particles, apple) {
  const colors = [apple.palette.base, apple.palette.highlight, apple.palette.mid, '#FFD700'];
  spawnBurst(particles, apple.x, apple.y, colors);
}
