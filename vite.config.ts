import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";
import notes from "./scripts/notes-plugin.mjs";

// start + ssr: 플러그인이 SSR 진입점·문서 쉘·dev 서버를 만든다. 빌드는 dist/client(+dist/server)로 나오고,
// scripts/prerender.mjs 가 모든 라우트를 정적 HTML로 구워 dist/ 를 완성한다.
export default defineConfig({
  plugins: [notes({ dir: "src/content/blog" }), solid({ start: {}, ssr: true })]
});
