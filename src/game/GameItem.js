// Per-bread palettes tuned to how each product actually bakes:
// toast stays pale with browned edges, croissants go glossy gold,
// bagels darken to a deep chew, baguettes sit in mid wheat brown.
export const BREAD_VARIANTS = [
  { shape: 'loaf', crust: '#d69a52', crumb: '#f7e3bc', dark: '#a06a2e', accent: '#fdf3dd' },
  { shape: 'roll', crust: '#c07c34', crumb: '#eec489', dark: '#7d4a17', accent: '#fae3b4' },
  { shape: 'baguette', crust: '#b9762f', crumb: '#eec78d', dark: '#7a4413', accent: '#fbe6ba' },
  { shape: 'croissant', crust: '#d99231', crumb: '#f8d68b', dark: '#955711', accent: '#fef0c4' },
  { shape: 'bagel', crust: '#9c5b22', crumb: '#d8a45f', dark: '#5c3009', accent: '#eecc93' },
];

const COFFEE_VARIANTS = [
  { roast: 'light', base: '#9c5f34', mid: '#7a4526', dark: '#4f2c17', sheen: '#c68a54' },
  { roast: 'medium', base: '#79462a', mid: '#5a331d', dark: '#331d10', sheen: '#a5713f' },
  { roast: 'dark', base: '#4a2c19', mid: '#301b0e', dark: '#170d06', sheen: '#71482a' },
  { roast: 'single', base: '#87542f', mid: '#663a20', dark: '#3d2411', sheen: '#b17f47' },
];

let breadCursor = 0;
let coffeeCursor = 0;

function nextBreadVariant() {
  const v = BREAD_VARIANTS[breadCursor % BREAD_VARIANTS.length];
  breadCursor++;
  return v;
}

function nextCoffeeVariant() {
  const v = COFFEE_VARIANTS[coffeeCursor % COFFEE_VARIANTS.length];
  coffeeCursor++;
  return v;
}

// Per-item jitter for organic (non-perfect) crust outlines
function generateEdgeSeed() {
  const points = 10;
  return Array.from({ length: points }, () => 0.92 + Math.random() * 0.1);
}

// Irregular soft bake-color blotches scattered across the crust
function generateMottleSpots() {
  const count = 7 + Math.floor(Math.random() * 4);
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 1.5,
    y: (Math.random() - 0.5) * 1.5,
    rx: 0.16 + Math.random() * 0.26,
    ry: 0.12 + Math.random() * 0.2,
    rot: Math.random() * Math.PI,
    alpha: 0.16 + Math.random() * 0.24,
    dark: Math.random() < 0.7,
  }));
}

// Fine grain pores for a floury / porous crust surface
function generatePores() {
  const count = 30 + Math.floor(Math.random() * 20);
  return Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 1.6,
    y: (Math.random() - 0.5) * 1.6,
    size: 0.014 + Math.random() * 0.03,
    alpha: 0.22 + Math.random() * 0.28,
  }));
}

export class GameItem {
  constructor(x, y, value, type) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.type = type || (Math.random() < 0.5 ? 'bread' : 'coffee');
    this.radius = 26;
    this.selected = false;
    this.scale = 0;
    this.targetScale = 1;
    this.removed = false;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.02 + Math.random() * 0.015;
    this.popProgress = 0;
    this.popping = false;
    this.rotation = (Math.random() - 0.5) * 0.5;
    this.bobPhase = Math.random() * Math.PI * 2;

    if (this.type === 'bread') {
      this.variant = nextBreadVariant();
      this.beanCount = null;
      this.edgeSeed = generateEdgeSeed();
      this.mottleSpots = generateMottleSpots();
      this.pores = generatePores();
    } else {
      this.variant = nextCoffeeVariant();
      this.beanCount = Math.random() < 0.35 ? 2 : 1;
    }
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
