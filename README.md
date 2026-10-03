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
- 커스텀 이벤트: `note_open`(card/direct/link), `search`, `bookmark_toggle`, `note_read_complete`, `theme_toggle`, `graph_node_click`
- 완독(`note_read_complete`): 본문 끝이 화면에 들어왔고, 예상 읽기 시간의 30% 이상 머문 경우. 탭 세션당 노트마다 한 번. 화면의 "✓ 읽음"(스크롤 96%)과는 별개.
- JS 에러(`$exception`)·Web Vitals 는 PostHog 로 수집. 자동화 브라우저(구글 렌더러·Headless·Lighthouse)에서는 로드하지 않는다.
- 주간 보고서: `node scripts/report.mjs` → `reports/YYYY-WW.md`. 키는 `.env`(커밋 금지): `GA4_PROPERTY_ID`, `GA4_SA_JSON_PATH`, `POSTHOG_PERSONAL_KEY`, `CLARITY_TOKEN`.
- 동의(opt-in): 방문자가 허용하기 전에는 어떤 도구도 로드하지 않는다. 첫 방문 알림(`AnalyticsNotice`)의 허용/거부, `/privacy` 페이지의 스위치, 푸터 링크. 수집 항목을 바꾸면 `/privacy` 의 표도 고친다.
- 내 방문 제외: 알림에서 거부하거나 `?notrack=1` (해제 `?notrack=0`).
