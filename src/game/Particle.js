export class Particle {
  constructor(x, y, color, opts = {}) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = opts.size ?? Math.random() * 5 + 2;
    const angle = opts.angle ?? Math.random() * Math.PI * 2;
    const speed = opts.speed ?? Math.random() * 5 + 2;
    this.speedX = Math.cos(angle) * speed;
    this.speedY = Math.sin(angle) * speed;
    this.gravity = opts.gravity ?? 0.15;
    this.life = 1;
    this.decay = opts.decay ?? (Math.random() * 0.03 + 0.02);
    this.shape = opts.shape ?? 'circle';
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.3;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += this.gravity;
    this.speedX *= 0.98;
    this.life -= this.decay;
    this.size *= 0.97;
    this.rotation += this.rotationSpeed;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    if (this.shape === 'star') {
      drawStar(ctx, this.size);
    } else if (this.shape === 'square') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawStar(ctx, size) {
  const spikes = 4;
  const outer = size;
  const inner = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

export function spawnBurst(particles, x, y, colors) {
  const shapes = ['circle', 'star', 'square'];
  for (let i = 0; i < 14; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    particles.push(new Particle(x, y, color, { shape, speed: Math.random() * 6 + 2 }));
  }
}
