const APPLE_PALETTES = [
  { base: '#ff5f52', mid: '#e0392c', dark: '#a3241a', highlight: '#ffb3a8' },
  { base: '#ff8a3d', mid: '#e0631f', dark: '#a34211', highlight: '#ffd0a3' },
  { base: '#ffd23f', mid: '#e0a913', dark: '#a37307', highlight: '#fff0b3' },
  { base: '#7ed957', mid: '#4fb32f', dark: '#2d7a17', highlight: '#c8f5ad' },
  { base: '#ff6b9d', mid: '#e0447a', dark: '#a32a54', highlight: '#ffc2d9' },
];

let paletteCursor = 0;
function nextPalette() {
  const p = APPLE_PALETTES[paletteCursor % APPLE_PALETTES.length];
  paletteCursor++;
  return p;
}

export class Apple {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = 26;
    this.selected = false;
    this.scale = 0;
    this.targetScale = 1;
    this.removed = false;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.02 + Math.random() * 0.015;
    this.palette = nextPalette();
    this.popProgress = 0;
    this.popping = false;
    this.leafAngle = -0.5 + Math.random() * 0.3;
    this.bobPhase = Math.random() * Math.PI * 2;
  }

  startPop() {
    this.popping = true;
  }

  update() {
    if (this.scale < this.targetScale) {
      this.scale += (this.targetScale - this.scale) * 0.18;
      if (this.targetScale - this.scale < 0.01) this.scale = this.targetScale;
    }
    this.wobble += this.wobbleSpeed;

    if (this.popping) {
      this.popProgress += 0.14;
      if (this.popProgress >= 1) {
        this.removed = true;
      }
    }
  }

  get renderScale() {
    if (this.popping) {
      const t = Math.min(this.popProgress, 1);
      const burst = 1 + Math.sin(t * Math.PI) * 0.35;
      return this.scale * burst * (1 - t * 0.9);
    }
    const bob = 1 + Math.sin(this.wobble) * 0.02;
    return this.scale * bob;
  }

  get renderOpacity() {
    if (this.popping) {
      return Math.max(0, 1 - this.popProgress);
    }
    return 1;
  }
}
