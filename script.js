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
        this.particles = []; // Particle system
        this.score = 0;
        this.isDrawing = false;
        this.currentPath = []; // Array of {x, y}
        this.dpr = window.devicePixelRatio || 1;

        // UI Elements
        this.scoreEl = document.getElementById('scoreValue');
        this.resetBtn = document.getElementById('resetBtn');
        this.lightModeToggle = document.getElementById('lightModeToggle');
        this.messageOverlay = document.getElementById('messageOverlay');
        this.playAgainBtn = document.getElementById('playAgainBtn');

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.bindEvents();
        this.startNewGame();
        this.loop();
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
        this.resetBtn.addEventListener('click', () => this.startNewGame());
        this.playAgainBtn.addEventListener('click', () => this.startNewGame());
        this.lightModeToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('light-mode', e.target.checked);
        });
    }

    startNewGame() {
        this.score = 0;
        this.updateScore(0);
        this.apples = [];
        this.generateApples();
        this.messageOverlay.classList.remove('visible');
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
        const pos = this.getPos(e);
        this.isDrawing = true;
        this.currentPath = [pos];
    }

    handleInputMove(e) {
        if (!this.isDrawing) return;
        const pos = this.getPos(e);
        // Simple distance check to avoid too many points
        const last = this.currentPath[this.currentPath.length - 1];
        const dist = Math.hypot(pos.x - last.x, pos.y - last.y);
        if (dist > 5) {
            this.currentPath.push(pos);
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

    checkSelection() {
        if (this.currentPath.length < 3) return;

        const selectedApples = [];

        // 1. Identify selected apples using Ray Casting algorithm
        for (const apple of this.apples) {
            if (apple.removed) continue;
            if (this.isPointInPolygon(apple, this.currentPath)) {
                selectedApples.push(apple);
            }
        }

        // 2. Calculate Sum
        const sum = selectedApples.reduce((acc, apple) => acc + apple.value, 0);

        // 3. Validate and Score
        if (sum === 10) {
            // Success!
            selectedApples.forEach(apple => {
                apple.removed = true;
                // Optional: Spawn particles here
            });
            this.updateScore(selectedApples.length);
            this.checkGameOver();
        } else {
            // Failure visual feedback could go here
            // For now, just clearing the line is enough (simple)
        }
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

    checkGameOver() {
        const remainingApples = this.apples.filter(a => !a.removed).length;
        if (remainingApples === 0) {
            setTimeout(() => {
                this.messageOverlay.classList.add('visible');
            }, 500);
        }
    }

    updateScore(points) {
        this.score += points;
        this.scoreEl.textContent = this.score;
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        this.apples.forEach(apple => apple.update());
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Apples
        this.apples.forEach(apple => {
            if (apple.removed) return;
            this.drawApple(apple);
        });

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

        // Apple Body
        this.ctx.beginPath();
        this.ctx.arc(0, 0, apple.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim();
        this.ctx.fill();

        // Number
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 20px "Outfit", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(apple.value, 0, 2); // Slight offset for visual center

        this.ctx.restore();
    }
}

// Start the game
window.onload = () => {
    new Game();
};
