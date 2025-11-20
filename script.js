/**
 * Fruit Box Game
 * 
 * Core Philosophy:
 * 1. Simple Data Structures: Apples are just objects {x, y, val, r}.
 * 2. No Over-engineering: Vanilla JS, Canvas API.
 * 3. Performance: RequestAnimationFrame for rendering.
 */

class Apple {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = 25; // Base radius
        this.selected = false;
        this.scale = 0; // For pop-in animation
        this.targetScale = 1;
        this.removed = false;
    }

    update() {
        // Simple spring animation for scale
        if (this.scale < this.targetScale) {
            this.scale += (this.targetScale - this.scale) * 0.1;
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * 6 - 3;
        this.life = 1;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
        this.size *= 0.95;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.apples = [];
        this.particles = [];
        this.score = 0;
        this.isDrawing = false;
        this.currentPath = [];
        this.dpr = window.devicePixelRatio || 1;

        // Game State
        this.state = 'INTRO'; // INTRO, PLAYING, FINISHED
        this.timeLeft = 60;
        this.timerInterval = null;

        // UI Elements
        this.scoreEl = document.getElementById('scoreValue');
        this.timerEl = document.getElementById('timerValue');
        this.timerDisplay = document.querySelector('.timer-display');
        this.resetBtn = document.getElementById('resetBtn');
        this.lightModeToggle = document.getElementById('lightModeToggle');

        this.introOverlay = document.getElementById('introOverlay');
        this.messageOverlay = document.getElementById('messageOverlay');
        this.messageTitle = document.getElementById('messageTitle');
        // this.messageSubtitle = document.getElementById('messageSubtitle'); // Removed/Unused

        this.finalScoreEl = document.getElementById('finalScore');
        this.bestScoreEl = document.getElementById('bestScore');
        this.newRecordBadge = document.getElementById('newRecordBadge');

        this.startBtn = document.getElementById('startBtn');
        this.playAgainBtn = document.getElementById('playAgainBtn');

        this.highScore = parseInt(localStorage.getItem('fruitBoxHighScore')) || 0;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.bindEvents();
        // Don't start game immediately, wait for user
        this.renderStatic();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * this.dpr;
        this.canvas.height = rect.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    bindEvents() {
        // Mouse / Touch Events
        const start = (e) => this.handleInputStart(e);
        const move = (e) => this.handleInputMove(e);
        const end = (e) => this.handleInputEnd(e);

        this.canvas.addEventListener('mousedown', start);
        this.canvas.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);

        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e.touches[0]); }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e.touches[0]); }, { passive: false });
        window.addEventListener('touchend', end);

        // UI Events
        this.startBtn.addEventListener('click', () => this.startGame());
        this.resetBtn.addEventListener('click', () => this.startGame()); // Reset now restarts
        this.playAgainBtn.addEventListener('click', () => this.startGame());
        this.lightModeToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('light-mode', e.target.checked);
        });
    }

    startGame() {
        this.introOverlay.classList.remove('visible');
        this.messageOverlay.classList.add('hidden'); // Ensure hidden
        this.messageOverlay.classList.remove('visible'); // Just in case
        this.startCountdown();
    }

    startCountdown() {
        this.state = 'COUNTDOWN';
        this.score = 0;
        this.timeLeft = 60;
        this.updateScore(0);
        this.updateTimerDisplay();
        this.timerDisplay.classList.remove('low-time');

        this.apples = [];
        this.generateApples(); // Initial batch

        const countdownOverlay = document.getElementById('countdownOverlay');
        const countdownValue = document.getElementById('countdownValue');
        countdownOverlay.classList.remove('hidden');

        let count = 3;
        countdownValue.textContent = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                countdownValue.textContent = count;
                // Reset animation
                countdownValue.style.animation = 'none';
                countdownValue.offsetHeight; /* trigger reflow */
                countdownValue.style.animation = null;
            } else {
                clearInterval(interval);
                countdownOverlay.classList.add('hidden');
                this.beginPlay();
            }
        }, 1000);
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

        // High Score Logic
        const isNewRecord = this.score > this.highScore;
        if (isNewRecord) {
            this.highScore = this.score;
            localStorage.setItem('fruitBoxHighScore', this.highScore);
        }

        // Update UI
        this.finalScoreEl.textContent = this.score;
        this.bestScoreEl.textContent = this.highScore;

        if (isNewRecord && this.score > 0) {
            this.newRecordBadge.classList.remove('hidden');
        } else {
            this.newRecordBadge.classList.add('hidden');
        }

        this.messageOverlay.classList.remove('hidden');
        // Force reflow for transition if we had one, but we use display:none so it's instant
        // If we want fade in, we need to handle display:flex vs opacity
        // For now, just showing it is fine.
        this.messageOverlay.classList.add('visible'); // If we want to use opacity transition later
    }


    generateApples() {
        this.apples = [];
        const appleRadius = 25;
        const buffer = 10; // Extra space between apples
        const maxAttempts = 1000;
        const totalApples = 30; // Target number of apples

        let attempts = 0;
        while (this.apples.length < totalApples && attempts < maxAttempts) {
            attempts++;
            const x = Math.random() * (this.width - 2 * (appleRadius + buffer)) + (appleRadius + buffer);
            const y = Math.random() * (this.height - 2 * (appleRadius + buffer)) + (appleRadius + buffer);

            // Check collision with existing apples
            let overlapping = false;
            for (const apple of this.apples) {
                const dx = apple.x - x;
                const dy = apple.y - y;
                const dist = Math.hypot(dx, dy);
                if (dist < (appleRadius * 2 + buffer)) {
                    overlapping = true;
                    break;
                }
            }

            if (!overlapping) {
                // Generate a random number 1-9
                // We want a distribution that makes sums of 10 likely
                // Uniform 1-9 is usually fine
                const value = Math.floor(Math.random() * 9) + 1;
                this.apples.push(new Apple(x, y, value));
            }
        }
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
        // Simple distance check to avoid too many points
        const last = this.currentPath[this.currentPath.length - 1];
        const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
        if (dist > 5) {
            this.currentPath.push(pos);
            this.checkRealTimeSelection(); // Highlighting
        }
    }

    handleInputEnd(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.checkSelection();
        this.currentPath = [];
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    checkRealTimeSelection() {
        if (this.currentPath.length < 3) {
            this.apples.forEach(a => a.selected = false);
            return;
        }

        for (const apple of this.apples) {
            if (apple.removed) continue;
            apple.selected = this.isPointInPolygon(apple, this.currentPath);
        }
    }

    checkSelection() {
        if (this.currentPath.length < 3) return;

        // Use the already calculated selection state
        const selectedApples = this.apples.filter(a => a.selected && !a.removed);
        const sum = selectedApples.reduce((acc, apple) => acc + apple.value, 0);

        if (sum === 10) {
            selectedApples.forEach(apple => {
                apple.removed = true;
                this.spawnParticles(apple.x, apple.y);
            });
            this.updateScore(selectedApples.length);
            this.checkRefill();
        }

        // Clear selection state
        this.apples.forEach(a => a.selected = false);
    }

    isPointInPolygon(point, vs) {
        // Ray-casting algorithm based on
        // https://github.com/substack/point-in-polygon
        const x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            const xi = vs[i].x, yi = vs[i].y;
            const xj = vs[j].x, yj = vs[j].y;

            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    checkRefill() {
        // Continuous Respawn: Maintain constant number of apples
        const targetApples = 30;
        const currentApples = this.apples.filter(a => !a.removed).length;
        const needed = targetApples - currentApples;

        if (needed > 0) {
            this.spawnNewApples(needed);
        }
    }

    spawnNewApples(count) {
        const appleRadius = 25;
        const buffer = 10;
        let attempts = 0;
        let added = 0;

        while (added < count && attempts < 500) {
            attempts++;
            const x = Math.random() * (this.width - 2 * (appleRadius + buffer)) + (appleRadius + buffer);
            const y = Math.random() * (this.height - 2 * (appleRadius + buffer)) + (appleRadius + buffer);

            // Check collision with ALL existing apples (including removed ones if we don't cleanup)
            // Actually we should filter out removed ones for collision check? 
            // No, removed ones are gone visually, so we can overlap them.
            // But we need to make sure we don't overlap with *visible* apples.

            let overlapping = false;
            for (const apple of this.apples) {
                if (apple.removed) continue; // Ignore removed apples
                const dx = apple.x - x;
                const dy = apple.y - y;
                const dist = Math.hypot(dx, dy);
                if (dist < (appleRadius * 2 + buffer)) {
                    overlapping = true;
                    break;
                }
            }

            if (!overlapping) {
                const value = Math.floor(Math.random() * 9) + 1;
                const newApple = new Apple(x, y, value);
                newApple.scale = 0; // Pop in effect
                this.apples.push(newApple);
                added++;
            }
        }

        // Cleanup removed apples to keep array size manageable
        // Only keep if particles need them? No, particles are separate.
        // We can filter out removed apples periodically or now.
        this.apples = this.apples.filter(a => !a.removed);
    }

    spawnParticles(x, y) {
        const colors = ['#FFD700', '#FF6347', '#ADFF2F', '#87CEEB']; // Gold, Tomato, GreenYellow, SkyBlue
        const color = colors[Math.floor(Math.random() * colors.length)];
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    updateScore(points) {
        if (points === 0) this.score = 0; // Reset
        else this.score += points;
        this.scoreEl.textContent = this.score;
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        this.apples.forEach(apple => apple.update());
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Apples
        this.apples.forEach(apple => {
            if (apple.removed) return;
            this.drawApple(apple);
        });

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));

        // Draw Path
        if (this.currentPath.length > 1) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--line-color').trim();
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
            for (let i = 1; i < this.currentPath.length; i++) {
                this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
            }
            this.ctx.stroke();
        }
    }

    drawApple(apple) {
        this.ctx.save();
        this.ctx.translate(apple.x, apple.y);
        this.ctx.scale(apple.scale, apple.scale);

        // Highlight Effect
        if (apple.selected) {
            this.ctx.shadowColor = 'white';
            this.ctx.shadowBlur = 20;
        }

        // Apple Body
        this.ctx.beginPath();
        this.ctx.arc(0, 0, apple.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
        this.ctx.fill();

        // Reset Shadow
        this.ctx.shadowBlur = 0;

        // Number
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px "Outfit", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(apple.value, 0, 2);

        this.ctx.restore();
    }
}

// Start the game
window.onload = () => {
    new Game();
};
