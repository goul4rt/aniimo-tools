// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://aniimo.ogoulart.dev',
  vite: {
    plugins: [tailwindcss()],
  },
});
