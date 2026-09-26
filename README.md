# React Tech Blog

Astro 7 + React 19 기반 기술 블로그. 정적으로 빌드하고 Cloudflare Workers Static Assets로 배포합니다.

## 구조

- `src/content/blog/` — 글(`.md` / `.mdx`). frontmatter: `title`, `description`, `pubDate`, `updatedDate?`, `tags`, `draft`
- `src/components/*.tsx` — React island (테마 토글 `client:load`, 글 검색 `client:idle`, MDX 데모 `client:visible`)
- `wrangler.jsonc` — Workers 설정 (`dist/`를 정적 에셋으로 서빙, 404는 `404.html`)

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (localhost:4321) |
| `npm run build` | 타입 체크 + `dist/` 빌드 |
| `npm run preview` | 빌드 후 `wrangler dev`로 Workers 런타임(workerd)에서 로컬 확인 |
| `npm run deploy` | 빌드 후 Cloudflare Workers에 배포 |

## 배포

1. `npx wrangler login` (CI에서는 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 환경변수)
2. `astro.config.mjs`의 `site`를 실제 도메인으로 변경 (canonical, RSS, sitemap에 사용)
3. `npm run deploy`

또는 Cloudflare 대시보드 Workers Builds에서 이 저장소를 연결하고 빌드 명령 `npm run build`, 배포 명령 `npx wrangler deploy`로 설정합니다.

> 서버 렌더링(SSR)이 필요해지면 `@astrojs/cloudflare` 어댑터를 추가하면 됩니다. 현재는 전부 정적 페이지라 어댑터 없이 Worker 스크립트 비용·콜드스타트가 0입니다.
