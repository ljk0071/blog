import { For } from "solid-js";
import PageHead from "~/components/PageHead";
import { tagCounts } from "~/lib/notes";

export default function Tags() {
  const max = Math.max(1, ...tagCounts.map(([, n]) => n));
  return (
    <main>
      <PageHead title="태그" description="주제별로 모아 심은 화단" path="/tags" />
      <div class="section-title first">
        <h1>화단 (태그)</h1>
        <span class="hand">주제별로 모아 심었어요</span>
      </div>
      <ul class="beds">
        <For each={tagCounts}>
          {([tag, count]) => (
            <li>
              <a class="card" href={`/tags/${encodeURIComponent(tag)}`} style={{ "font-size": `${0.95 + (count / max) * 0.5}rem` }}>
                #{tag} <span class="muted">{count}</span>
              </a>
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
