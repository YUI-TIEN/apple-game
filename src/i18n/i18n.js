import { LOCALES, DEFAULT_LOCALE } from './locales.js';

const STORAGE_KEY = 'appleGameLocale';

function detectBrowserLocale() {
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export class I18n {
  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.locale = saved && LOCALES[saved] ? saved : detectBrowserLocale();
    this.listeners = [];
  }

  t(path) {
    const dict = LOCALES[this.locale] || LOCALES[DEFAULT_LOCALE];
    const value = getByPath(dict, path);
    return value == null ? path : value;
  }

  setLocale(locale) {
    if (!LOCALES[locale] || locale === this.locale) return;
    this.locale = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    this.listeners.forEach((fn) => fn(locale));
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  availableLocales() {
    return Object.entries(LOCALES).map(([code, def]) => ({ code, name: def.name }));
  }

  applyToDOM(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.innerHTML = this.t(key);
    });
    document.title = this.t('title');
    document.documentElement.lang = this.locale;
  }
}

export const i18n = new I18n();
