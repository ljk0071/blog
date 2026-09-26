// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// 블로그는 전부 정적 페이지이므로 어댑터 없이 static 빌드 후
// Cloudflare Workers Static Assets(wrangler.jsonc)로 서빙한다.
export default defineConfig({
  site: 'https://ssobbs13.is-a.dev',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  prefetch: { prefetchAll: true },
  integrations: [mdx(), react(), sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
    },
  },
});
