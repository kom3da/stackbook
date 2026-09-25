import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://stackbook.kom3da.dev',
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss()] },
});
