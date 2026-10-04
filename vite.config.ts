import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Vite copies public/ verbatim, and the raw icons in it are ~19,300 files —
 * 97% of Cloudflare Pages' free 20,000-file limit on their own, with no room
 * for a patch. Only the packed sheets from build:sprites are deployed; the raw
 * icons stay local as the source those sheets are built from.
 */
function dropRawIcons(): Plugin {
  return {
    name: 'drop-raw-icons',
    apply: 'build',
    async closeBundle() {
      await rm(join(process.cwd(), 'dist', 'icons'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dropRawIcons()],
});
