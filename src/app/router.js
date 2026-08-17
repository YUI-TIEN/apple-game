// Path-based router. Screens are addressed by URL so the host console and the
// projector board (#3) can be opened directly and shared as links.
//
// Vite's BASE_URL is '/' in dev and '/apple-game/' on GitHub Pages, so every
// path we read is stripped of the base and every href we write gets it back.

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export class Router {
  constructor(routes, { fallback = '/' } = {}) {
    this.routes = routes;
    this.fallback = fallback;
    this.handler = () => {};
  }

  currentPath() {
    let path = window.location.pathname;
    if (BASE && path.startsWith(BASE)) path = path.slice(BASE.length);
    if (!path.startsWith('/')) path = `/${path}`;
    return path.replace(/\/+$/, '') || '/';
  }

  resolve(path = this.currentPath()) {
    return this.routes[path] || null;
  }

  href(path) {
    return path === '/' ? `${BASE}/` : `${BASE}${path}`;
  }

  go(path, { replace = false } = {}) {
    if (path === this.currentPath()) {
      this.dispatch();
      return;
    }
    const url = this.href(path);
    if (replace) window.history.replaceState({ path }, '', url);
    else window.history.pushState({ path }, '', url);
    this.dispatch();
  }

  onNavigate(fn) {
    this.handler = fn;
  }

  start() {
    window.addEventListener('popstate', () => this.dispatch());
    // An unknown deep link lands on the menu without leaving a dead entry in
    // history, so Back still exits the site instead of bouncing on the 404.
    if (!this.resolve()) {
      this.go(this.fallback, { replace: true });
      return;
    }
    this.dispatch();
  }

  dispatch() {
    const path = this.currentPath();
    this.handler(this.resolve(path) || this.routes[this.fallback], path);
  }
}
