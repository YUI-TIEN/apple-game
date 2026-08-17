import { Apple } from './Apple.js';
import { drawApple } from './renderApple.js';

const HERO_LAYOUT = [
  { xr: 0.5, yr: 0.42, value: 6, radiusScale: 1.5, phase: 0 },
  { xr: 0.28, yr: 0.58, value: 4, radiusScale: 1.05, phase: 1.4 },
  { xr: 0.72, yr: 0.6, value: 3, radiusScale: 1.05, phase: 2.6 },
  { xr: 0.38, yr: 0.22, value: 9, radiusScale: 0.75, phase: 3.8 },
  { xr: 0.65, yr: 0.24, value: 1, radiusScale: 0.75, phase: 5.0 },
];

export class HeroApples {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.apples = HERO_LAYOUT.map((spec) => {
      const apple = new Apple(0, 0, spec.value);
      apple.radius = 26 * spec.radiusScale;
      apple.targetScale = 1;
      apple.scale = 1;
      apple.spec = spec;
      return apple;
    });
    this.time = 0;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
  }

  update() {
    this.time += 0.016;
    this.apples.forEach((apple) => {
      const { xr, yr, phase } = apple.spec;
      apple.x = xr * this.width;
      apple.y = yr * this.height + Math.sin(this.time * 0.8 + phase) * 10;
      apple.update();
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.apples.forEach((apple) => drawApple(this.ctx, apple));
  }
}
