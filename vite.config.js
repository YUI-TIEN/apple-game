import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// GitHub Pages serves 404.html for any unknown path, so shipping a copy of the
// app there is what makes /solo, /join (and later /host, /board) survive a
// direct hit or a refresh instead of returning the GitHub 404 page.
function spaFallback() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist');
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [spaFallback()],
});
