import { For } from "solid-js";
import { PORTFOLIO } from "~/consts";

export default function PortfolioCard() {
  const host = new URL(PORTFOLIO.url).host;
  return (
    <a class="portfolio card" href={PORTFOLIO.url} target="_blank" rel="noopener">
      <div class="browser" aria-hidden="true">
        <span class="dots">
          <i />
          <i />
          <i />
        </span>
        <span class="addr">{host}</span>
      </div>
      <div class="body">
        <p class="hand">정원 밖의 일기장 →</p>
        <h3>{PORTFOLIO.title}</h3>
        <p class="desc">{PORTFOLIO.description}</p>
        <ul class="chips">
          <For each={PORTFOLIO.highlights}>{(h) => <li>{h}</li>}</For>
        </ul>
        <span class="cta">{host} 방문하기 ↗</span>
      </div>
    </a>
  );
}
