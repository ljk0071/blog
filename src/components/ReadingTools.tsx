import { For, Show, createSignal, onSettled, type Accessor } from "solid-js";
import { useProgress, DONE_RATIO } from "~/lib/progress";
import type { NoteMeta } from "~/lib/notes";

/**
 * 스크롤 위치로 읽기 진행도(0~1)와 현재 보고 있는 소제목을 계산한다.
 * 브라우저 전용 상태라 onSettled 안에서 리스너를 달고, 반환하는 함수로 정리한다.
 * 진행도는 멈춘 뒤 한 번만 저장한다(스크롤이 끝나고 500ms).
 */
export function createReadingTracker(noteId: Accessor<string>) {
  const { record } = useProgress();
  const [ratio, setRatio] = createSignal(0);
  const [current, setCurrent] = createSignal("");

  onSettled(() => {
    let frame = 0;
    let save: ReturnType<typeof setTimeout> | undefined;

    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - innerHeight;
      const r = max > 0 ? Math.min(1, scrollY / max) : 1;
      setRatio(r);

      let id = "";
      for (const h of document.querySelectorAll<HTMLElement>(".reader .prose h2, .reader .prose h3")) {
        if (h.getBoundingClientRect().top < 140) id = h.id;
        else break;
      }
      setCurrent(id);

      clearTimeout(save);
      // 맨 위 근처는 기록하지 않는다 (이동 직후 scrollTo(0) 이 기존 진행도를 지우지 않도록)
      if (r >= 0.02) save = setTimeout(() => record(noteId(), r), 500);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(save);
    };
  });

  return { ratio, current };
}

export function ReadingBar(props: { ratio: Accessor<number> }) {
  return (
    <div class="reading-bar" aria-hidden="true">
      <span style={{ "--p": props.ratio() }} />
    </div>
  );
}

export function Toc(props: { note: NoteMeta; current: Accessor<string> }) {
  return (
    <Show when={props.note.headings.length >= 3}>
      <nav class="toc card" aria-label="목차" data-fade="body">
        <strong>목차</strong>
        <ol>
          <For each={props.note.headings}>
            {(h) => (
              <li class={{ sub: h.depth === 3 }}>
                <a href={`#${h.id}`} data-current={props.current() === h.id ? "" : undefined}>
                  {h.text}
                </a>
              </li>
            )}
          </For>
        </ol>
      </nav>
    </Show>
  );
}

/** 저장해 둔 읽기 위치가 있으면 "이어 읽기" 버튼을 보여 준다 */
export function ResumeButton(props: { id: string }) {
  const { progress } = useProgress();
  const saved = () => progress[props.id]?.ratio ?? 0;
  const goto = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: saved() * max, behavior: "smooth" });
  };
  return (
    <Show when={saved() > 0.03 && saved() < DONE_RATIO}>
      <button type="button" onClick={goto}>
        이어 읽기 · {Math.round(saved() * 100)}%
      </button>
    </Show>
  );
}
