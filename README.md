# React Tech Blog

Astro 7 + React 19 기반 기술 블로그. 정적으로 빌드하고 Cloudflare Pages로 배포합니다.

## 구조

- `src/content/blog/` — 글(`.md` / `.mdx`). frontmatter: `title`, `description`, `pubDate`, `updatedDate?`, `tags`, `draft`
- `src/components/*.tsx` — React island (테마 토글 `client:load`, 글 검색 `client:idle`, MDX 데모 `client:visible`)
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
