import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  vite: { server: { host: '127.0.0.1' } },
});
