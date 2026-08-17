import './styles/main.css';
import { Game } from './game/Game.js';
import { i18n } from './i18n/i18n.js';

function setupLanguageSwitcher() {
  const select = document.getElementById('langSelect');
  if (!select) return;

  select.innerHTML = i18n.availableLocales()
    .map(({ code, name }) => `<option value="${code}">${name}</option>`)
    .join('');
  select.value = i18n.locale;

  select.addEventListener('change', (e) => {
    i18n.setLocale(e.target.value);
  });

  i18n.onChange(() => {
    i18n.applyToDOM();
  });
}

setupLanguageSwitcher();
i18n.applyToDOM();

window.addEventListener('load', () => {
  new Game();
});
