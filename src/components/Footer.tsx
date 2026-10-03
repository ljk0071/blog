import { PORTFOLIO } from "~/consts";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer class="site-footer">
      <p class="hand">천천히, 꾸준히 자라는 중 🌱</p>
      <p class="muted">
        © {year} ssobbs13 ·{" "}
        <a href={PORTFOLIO.url} target="_blank" rel="noopener">
          포트폴리오
        </a>{" "}
        · <a href="/rss.xml" target="_self" rel="external">RSS</a> · <a href="/privacy">방문 분석 안내</a>
      </p>
    </footer>
  );
}
