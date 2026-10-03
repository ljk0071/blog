import { For, Show, onCleanup } from "solid-js";
import { STAGES } from "~/consts";
import { useBookmarks } from "~/lib/bookmarks";
import { formatDate, type NoteMeta } from "~/lib/notes";
import { DONE_RATIO, useProgress } from "~/lib/progress";
import { captureOrigin } from "~/lib/reader";

/**
 * 카드를 누르는 순간(capture 단계라 라우터보다 먼저) 카드 위치와 화면 복제본을 저장해 두는 directive factory.
 * setup 단계(소유됨)에서 정리 함수를 등록하고, 반환하는 함수(ref)는 요소만 붙잡는다.
 */
function cardOrigin(id: () => string) {
  let el: HTMLElement | undefined;
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest("a");
    // 제목(카드 전체를 덮는 링크)만 해당. 태그 링크는 다른 페이지로 간다.
    if (!el || !a || a.getAttribute("href") !== `/blog/${id()}`) return;
    captureOrigin(id(), el);
  };
  onCleanup(() => el?.removeEventListener("click", onClick, true));
  return (next: HTMLElement) => {
    el = next;
    next.addEventListener("click", onClick, true);
  };
}

export interface Snippet {
  before: string;
  match: string;
  after: string;
}

export default function NoteCard(props: { note: NoteMeta; snippet?: Snippet }) {
  const bookmarks = useBookmarks();
  const { progress } = useProgress();
  const stage = () => STAGES[props.note.stage];
  const read = () => progress[props.note.id];
  const readLabel = () => {
    const r = read();
    if (!r || r.ratio < 0.03) return undefined;
    return r.ratio >= DONE_RATIO ? "✓ 읽음" : `읽는 중 ${Math.round(r.ratio * 100)}%`;
  };

  return (
    <li>
      <article class="note" ref={cardOrigin(() => props.note.id)}>
        <span class="note-bg" aria-hidden="true" />
        <div class="note-top">
          <span class="stage" title={stage().hint}>
            {stage().emoji} {stage().label}
          </span>
          <Show when={bookmarks.has(props.note.id)}>
            <span class="note-saved" title="읽을 목록에 저장됨" role="img" aria-label="읽을 목록에 저장됨">
              🔖
            </span>
          </Show>
        </div>
        <a class="title" href={`/blog/${props.note.id}`}>
          {props.note.title}
        </a>
        <p class="desc">{props.note.description}</p>
        <Show when={props.snippet}>
          {(s) => (
            <p class="hit-snippet">
              …{s().before}
              <mark>{s().match}</mark>
              {s().after}…
            </p>
          )}
        </Show>
        <div class="meta">
          <time datetime={props.note.pubDate}>{formatDate(props.note.pubDate)}</time>
          <For each={props.note.tags}>
            {(t) => (
              <a class="tag" href={`/tags/${encodeURIComponent(t)}`}>
                #{t}
              </a>
            )}
          </For>
          <Show when={readLabel()}>{(label) => <span class="note-progress">{label()}</span>}</Show>
        </div>
      </article>
    </li>
  );
}
