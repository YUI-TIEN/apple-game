export class Background {
  constructor() {
    this.blobs = Array.from({ length: 4 }, (_, i) => ({
      angle: (Math.PI * 2 * i) / 4,
      speed: 0.0006 + i * 0.0002,
      radiusFactor: 0.35 + i * 0.08,
      sizeFactor: 0.35 + Math.random() * 0.15,
    }));
    this.time = 0;
  }

  update() {
    this.time += 1;
  }

  draw(ctx, width, height, isLight) {
    const colors = isLight
      ? ['rgba(255,140,120,0.10)', 'rgba(120,200,255,0.10)', 'rgba(255,220,120,0.10)', 'rgba(150,255,180,0.10)']
      : ['rgba(255,107,107,0.09)', 'rgba(78,205,196,0.09)', 'rgba(255,230,109,0.07)', 'rgba(120,140,255,0.08)'];

    this.blobs.forEach((blob, i) => {
      const a = blob.angle + this.time * blob.speed;
      const cx = width / 2 + Math.cos(a) * width * blob.radiusFactor * 0.5;
      const cy = height / 2 + Math.sin(a * 1.3) * height * blob.radiusFactor * 0.5;
      const r = Math.max(width, height) * blob.sizeFactor;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, colors[i % colors.length]);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    });
  }
}
