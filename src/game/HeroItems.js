import { GameItem } from './GameItem.js';
import { drawItem } from './renderItem.js';

const HERO_LAYOUT = [
  { xr: 0.5, yr: 0.42, value: 6, radiusScale: 1.5, phase: 0, type: 'bread' },
  { xr: 0.26, yr: 0.6, value: 4, radiusScale: 1.1, phase: 1.4, type: 'coffee' },
  { xr: 0.74, yr: 0.62, value: 3, radiusScale: 1.1, phase: 2.6, type: 'bread' },
  { xr: 0.35, yr: 0.2, value: 9, radiusScale: 0.95, phase: 3.8, type: 'coffee' },
  { xr: 0.68, yr: 0.22, value: 1, radiusScale: 0.95, phase: 5.0, type: 'bread' },
];

export class HeroItems {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.items = HERO_LAYOUT.map((spec) => {
      const item = new GameItem(0, 0, spec.value, spec.type);
      item.radius = 26 * spec.radiusScale;
      item.targetScale = 1;
      item.scale = 1;
      item.spec = spec;
      return item;
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
    this.items.forEach((item) => {
      const { xr, yr, phase } = item.spec;
      item.x = xr * this.width;
      item.y = yr * this.height + Math.sin(this.time * 0.8 + phase) * 10;
      item.update();
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.items.forEach((item) => drawItem(this.ctx, item));
  }
}
