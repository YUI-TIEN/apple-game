// One visible screen at a time. Screens own their own lifecycle through
// onEnter/onLeave so nothing that animates keeps running off-screen.

export class ScreenManager {
  constructor() {
    this.screens = new Map();
    this.active = null;
  }

  register(name, { el, onEnter, onLeave } = {}) {
    if (!el) throw new Error(`Screen "${name}" has no element`);
    el.classList.add('hidden');
    this.screens.set(name, { el, onEnter, onLeave });
  }

  show(name) {
    const next = this.screens.get(name);
    if (!next) throw new Error(`Unknown screen: ${name}`);
    if (this.active === name) return;

    if (this.active) {
      const prev = this.screens.get(this.active);
      prev.el.classList.add('hidden');
      prev.onLeave?.();
    }

    this.active = name;
    next.el.classList.remove('hidden');
    next.onEnter?.();
  }
}
