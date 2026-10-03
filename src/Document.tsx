import { HydrationScript, type JSX } from "@solidjs/web";
import { SITE_TITLE } from "./consts";

// <head>가 렌더되기 전에 테마를 적용해 깜빡임(FOUC)을 막는다. 저장값이 없으면 기기의 다크모드 설정을 따른다.
const themeScript = `(()=>{let s=null;try{s=localStorage.getItem('theme')}catch{}const d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'})()`;

// <title> 은 라우트가 <Title> 을 선언하지 않았을 때의 기본값이다. description 등 나머지 head 태그는 각 페이지가 PageHead 로 선언한다(중복 방지).
export default function Document(props: { children?: JSX.Element }) {
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{SITE_TITLE}</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate" type="application/rss+xml" title={SITE_TITLE} href="/rss.xml" />
        <script innerHTML={themeScript} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
