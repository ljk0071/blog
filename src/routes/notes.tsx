import { useSearchParams } from "@solidjs/router";
import { For, Loading, Show, createEffect, createMemo, createSignal, isPending } from "solid-js";
import NoteList from "~/components/NoteList";
import PageHead from "~/components/PageHead";
import { NotesSkeleton } from "~/components/Skeletons";
import { STAGES } from "~/consts";
import { track } from "~/lib/analytics";
import { notes } from "~/lib/notes";
import { STAGE_FILTERS, byStage, loadSearchIndex, parseStage, runSearch, type Hit, type StageFilter } from "~/lib/search";

export default function Notes() {
  const [params, setParams] = useSearchParams<{ q?: string; stage?: string }>();

  // 입력값은 "URL 에서 파생되지만 직접 쓸 수도 있는" 상태 → 쓰기 가능한 파생 signal.
  // 타이핑하면 즉시 화면이 반응하고, 뒤로 가기로 URL 이 바뀌면 입력창도 URL 값으로 다시 파생된다.
  const [query, setQuery] = createSignal(() => params.q ?? "");
  const [stage, setStage] = createSignal<StageFilter>(() => parseStage(params.stage));

  // URL 동기화는 effect 의 apply 단계(부수효과)에서. 타이핑이 멈추면(300ms) 주소창을 갱신한다.
  createEffect(
    () => ({ q: query().trim(), stage: stage() }),
    ({ q, stage }) => {
      const t = setTimeout(() => {
        if (q) track("search", { query: q, stage });
        setParams({ q: q || undefined, stage: stage === "all" ? undefined : stage }, { replace: true });
      }, 300);
      return () => clearTimeout(t);
    },
    { defer: true }
  );

  // 결과: 검색어가 없으면 동기 값, 있으면 색인(별도 청크)을 비동기로 읽는 Promise.
  // 이 memo 하나가 "스켈레톤(처음 로드)"과 "흐리게 + 검색 중…(바뀌는 중)"을 모두 만든다.
  const hits = createMemo((): Hit[] | Promise<Hit[]> => {
    const q = query().trim();
    if (!q) return byStage(stage()).map((note) => ({ note }));
    const s = stage();
    return loadSearchIndex().then((index) => runSearch(index, q, s));
  });

  const searching = () => isPending(() => hits());

  return (
    <main class="wide">
      <PageHead title="모든 노트" description="문제를 파고든 기록들을 모아 두었어요." path="/blog" />
      <div class="section-title first">
        <h1>모든 노트</h1>
        <span class="hand">{notes.length}개가 자라는 중</span>
      </div>

      <div class="search-bar">
        <div class="search-box">
          <input
            type="search"
            name="q"
            placeholder="🔍 제목, 설명, 태그, 본문으로 찾기"
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            aria-label="노트 검색"
            autocomplete="off"
          />
          <Loading fallback={<span class="search-status" data-pending>색인 불러오는 중…</span>}>
            <span class="search-status" data-pending={searching() ? "" : undefined} aria-live="polite">
              {searching() ? "검색 중…" : ""}
            </span>
          </Loading>
        </div>
        <div class="filters" role="group" aria-label="성장 단계 필터">
          <For each={STAGE_FILTERS}>
            {(f) => (
              <button type="button" aria-pressed={stage() === f ? "true" : "false"} onClick={() => setStage(f)}>
                {f === "all" ? "전체" : `${STAGES[f].emoji} ${STAGES[f].label}`}
              </button>
            )}
          </For>
        </div>
      </div>

      <Loading fallback={<NotesSkeleton count={4} />}>
        <div class="results" data-pending={searching() ? "" : undefined}>
          <Show when={query().trim()}>
            <p class="search-hits">{hits().length}개의 노트</p>
          </Show>
          <NoteList
            notes={hits().map((h) => h.note)}
            snippets={Object.fromEntries(hits().map((h) => [h.note.id, h.snippet]))}
            empty="일치하는 노트가 없어요. 다른 단어로 찾아볼까요? 🌱"
          />
        </div>
      </Loading>
    </main>
  );
}
