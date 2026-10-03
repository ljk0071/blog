# ssobbs13의 정원

순수 **Solid 2.0** (RC) 으로 만든 기술 블로그. Astro/React 없이 `@solidjs/vite-plugin` SSR → 빌드 시 정적 prerender → Cloudflare Pages.

## 명령어
- `npm run dev` — 개발 서버
- `npm run build` — vite build + 정적 prerender (`dist/`)
- `npm run typecheck`

## 글 쓰기
`src/content/blog/*.md` 에 frontmatter(title, description, pubDate, tags, stage) 와 함께 작성.

## Solid 2.0 적용 지점
- `<Loading>` + 스켈레톤, `isPending`(이전 화면 유지하며 흐리게), `<Reveal>`, `<Errored>`(재시도)
- `action` + `createOptimisticStore` (북마크 낙관적 업데이트, IndexedDB 영속)
- 파생 store/signal (`createStore(fn)`, writable derived signal), 분리형 `createEffect`, `onSettled`
- `lazy` 라우트 분할, `clientOnly`, `httpStatus(404)`, router `matchFilters`, `@solidjs/meta`

## 배포
Cloudflare Pages: build `npm run build`, output `dist`, Node 22.
