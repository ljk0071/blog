import { Show } from "solid-js";
import { PORTFOLIO, SITE_TITLE } from "~/consts";
import { useBookmarks } from "~/lib/bookmarks";
import { useTheme } from "~/lib/theme";

export default function Header() {
  const bookmarks = useBookmarks();
  const { theme, toggle } = useTheme();

  return (
    <header class="site-header">
      <nav class="site-nav" aria-label="주 메뉴">
        {/* 라우터가 현재 위치에 맞춰 <a> 에 aria-current / data-active 를 알아서 붙인다 */}
        <a class="brand" href="/">
          <span aria-hidden="true">🌿</span> {SITE_TITLE}
        </a>
        <div class="nav-links">
          <a href="/blog">노트</a>
          <a href="/tags">태그</a>
          <a href="/saved">
            읽을 목록
            <Show when={bookmarks.saved.length > 0}>
              <span class="nav-badge" aria-label={`${bookmarks.saved.length}개 저장됨`}>
                {bookmarks.saved.length}
              </span>
            </Show>
          </a>
          <a href="/about">소개</a>
          <a href={PORTFOLIO.url} target="_blank" rel="noopener">
            포트폴리오 ↗
          </a>
          <button
            type="button"
            class="theme-toggle"
            onClick={toggle}
            aria-label="테마 전환"
            title={theme() === "dark" ? "낮의 정원으로" : "밤의 정원으로"}
          >
            {theme() === null ? " " : theme() === "dark" ? "☀︎" : "☾"}
          </button>
        </div>
      </nav>
    </header>
  );
}
