import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://stackbook.kom3da.dev',
  trailingSlash: 'always',
  // Switching kinds on the make page stays a page move; hovering a link loads it ahead
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
