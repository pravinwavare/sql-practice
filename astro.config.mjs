// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://pravinwavare.github.io',
  vite: {
    plugins: [tailwindcss()]
  }
});
