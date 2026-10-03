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

## 방문 분석 (GA4 + Clarity + PostHog)
- 식별자는 `src/consts.ts` 의 `ANALYTICS` (공개용 값). 로직은 `src/lib/analytics.ts`, hydrate 후에만 로드.
- 페이지뷰: 라우트 변경 시 직접 전송. GA4 스트림의 "브라우저 기록 이벤트에 따른 페이지 변경" 향상된 측정은 꺼야 중복되지 않는다.
- 커스텀 이벤트: `note_open`(card/direct), `search`, `bookmark_toggle`, `note_read_complete`, `theme_toggle`, `graph_node_click`
- 내 방문 제외: `?notrack=1` (해제 `?notrack=0`), 브라우저 DNT 도 존중.
