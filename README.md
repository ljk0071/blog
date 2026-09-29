# ssobbs13의 정원

백엔드 개발자 ssobbs13의 문제 해결 기록을 담은 디지털 가든. Astro 7 + React 19로 만들었습니다. 정적으로 빌드하고 Cloudflare Pages로 배포합니다.

## 구조

- `src/content/blog/` — 노트(`.md` / `.mdx`). frontmatter: `title`, `description`, `pubDate`, `updatedDate?`, `tags`, `stage`(`seedling`🌱/`budding`🌿/`evergreen`🌳), `draft`
  - 본문에서 `[텍스트](/blog/<id>)`로 다른 노트를 링크하면 정원 지도·백링크·미리보기에 자동 반영
- `src/consts.ts` — 사이트 제목, 이력·일하는 방식(`PROFILE`), 포트폴리오 섹션(`PORTFOLIO`), 성장 단계 라벨
- `src/components/*.tsx` — React island: 노트 목록 + 글 오버레이(`NoteBrowser`/`NoteCard`/`NoteOverlay`), 정원 지도(`GardenGraph`), 링크 미리보기(`LinkPreview`), 테마 토글
- `wrangler.jsonc` — Pages 설정 (`dist/` 서빙, 404는 `404.html`)

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (localhost:4321) |
| `npm run build` | 타입 체크 + `dist/` 빌드 |
| `npm run preview` | 빌드 후 `wrangler pages dev`로 로컬 확인 |
| `npm run deploy` | 빌드 후 `wrangler pages deploy`로 수동 배포 |

## 배포 (Cloudflare Pages)

대시보드 Workers & Pages → Create → Pages → Git 연결에서 이 저장소를 선택하고:

- 프로덕션 브랜치: `main`
- 빌드 명령: `npm run build`
- 빌드 출력 디렉터리: `dist`

`main`에 푸시하면 자동 배포되고, 다른 브랜치는 프리뷰 URL로 배포됩니다.

> Workers가 아니라 Pages를 쓰는 이유: is-a.dev처럼 내 Cloudflare 계정에 없는 도메인을 CNAME으로 연결하는 커스텀 도메인은 Pages만 지원합니다.

## 커스텀 도메인 (is-a.dev)

1. Pages 프로젝트 → Custom domains에 `<이름>.is-a.dev` 추가
2. is-a.dev에 `{"records": {"CNAME": "<프로젝트>.pages.dev"}}` 등록 (proxied 끔)
3. `astro.config.mjs`의 `site`를 해당 도메인으로 변경

Google Search Console은 DNS TXT 대신 URL 접두어 속성의 HTML 태그 인증을 사용합니다. `src/consts.ts`의 `GOOGLE_SITE_VERIFICATION`에 값을 넣으면 됩니다.

## 페이지 전환 (ClientRouter)

링크 이동은 Astro `<ClientRouter />`가 새 HTML만 받아 View Transition으로 교체합니다. 모든 페이지는 여전히 완성된 정적 HTML이라 SEO에는 영향이 없습니다.

스크립트를 추가할 때 주의할 점:

- 번들되는 `<script>`는 **처음 한 번만** 실행됩니다. 페이지마다 실행해야 하는 코드는 `document.addEventListener('astro:page-load', ...)` 안에 넣습니다.
- 방문 통계(GA 등)는 첫 로드 외에 페이지 이동마다 `astro:page-load`에서 page view를 보내야 합니다.
- head의 인라인 스크립트는 다시 실행되지 않습니다(테마 적용은 `astro:before-swap`에서 처리 중).
- body의 `is:inline` 스크립트는 페이지 교체 시 다시 실행됩니다.

## 노트 오버레이

목록(홈·/blog·태그·소개)에서 노트 카드를 누르면 페이지를 이동하지 않고 글을 목록 위에 연다.

- **120Hz 애니메이션:** iOS Safari는 JS(requestAnimationFrame) 애니메이션을 60Hz로 제한하므로,
  Web Animations API로 `transform`·`opacity`만 움직여 컴포지터에서 그린다(`flip.ts`).
  spring 곡선은 물리 시뮬레이션 결과를 CSS `linear()` 이징으로 구워서 쓴다.
- **FLIP:** 글 페이지 전체(헤더 + 본문)를 하나의 레이어로 두고, 헤더 카드가 목록 카드와 겹치도록
  축소·이동한 상태에서 원래 자리로 되돌린다. 본문이 처음부터 헤더에 붙어 함께 커져 빈 화면이 없다.
- **되감기:** 여는 도중 닫으면 진행 중인 애니메이션을 그 자리에서 `reverse()`한다.
  글을 오른쪽으로 끌면 손가락을 따라 작아지고, 놓으면 그 위치에서 카드 자리로 줄어든다.
- 본문은 정적 글 페이지(`/blog/<id>`) HTML을 미리 받아 `.prose` 부분만 꺼내 쓴다(`noteContent.ts`).
- URL은 `history.pushState`로 `/blog/<id>`가 된다. 주소로 직접 들어오면 정적 글 페이지가 열리므로 SEO는 그대로.
- 뒤로/앞으로 가기는 `BaseHead`의 popstate 훅(`window.__notePopState`)이 ClientRouter보다 먼저 받아 처리한다.
  브라우저가 자체 스와이프 애니메이션을 보여 준 경우(`hasUAVisualTransition`)엔 우리 애니메이션을 생략한다.
