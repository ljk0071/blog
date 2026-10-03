import { For, Show, createSignal, onSettled, type Accessor } from "solid-js";
import { useProgress, DONE_RATIO } from "~/lib/progress";
import type { NoteMeta } from "~/lib/notes";
import { track } from "~/lib/analytics";

/** 예상 읽기 시간의 이 비율만큼은 머물러야 "완독"으로 센다 (훑어 내리기만 한 방문을 거른다) */
const READ_TIME_RATIO = 0.3;
const DONE_KEY = "read-complete";

// 완독 이벤트는 탭 세션당 노트마다 한 번. (화면의 "✓ 읽음" 표시는 progress 가 따로 관리한다)
function alreadyCounted(id: string): boolean {
  try {
    const done: string[] = JSON.parse(sessionStorage.getItem(DONE_KEY) ?? "[]");
    if (done.includes(id)) return true;
    sessionStorage.setItem(DONE_KEY, JSON.stringify([...done, id]));
  } catch {
    // 저장소를 못 쓰면 중복을 감수한다
  }
  return false;
}

/**
 * 스크롤 위치로 읽기 진행도(0~1)와 현재 보고 있는 소제목을 계산한다.
 * 브라우저 전용 상태라 onSettled 안에서 리스너를 달고, 반환하는 함수로 정리한다.
 * 진행도는 멈춘 뒤 한 번만 저장한다(스크롤이 끝나고 500ms).
 *
 * 분석용 "완독"(note_read_complete)은 진행도와 별개로 센다:
 * 본문(.prose) 끝이 화면에 들어온 적이 있고, 탭이 보이는 상태로 예상 읽기 시간의 30% 이상 머물렀을 때.
 */
export function createReadingTracker(noteId: Accessor<string>, minutes: Accessor<number>) {
  const { record } = useProgress();
  const [ratio, setRatio] = createSignal(0);
  const [current, setCurrent] = createSignal("");

  onSettled(() => {
    let frame = 0;
    let save: ReturnType<typeof setTimeout> | undefined;

    // 완독 판정 상태 (노트가 바뀌면 초기화)
    let reading = { id: "", visibleMs: 0, since: 0, reachedEnd: false, done: false };
    let wait: ReturnType<typeof setTimeout> | undefined;
    const visible = () => document.visibilityState === "visible";
    const checkComplete = () => {
      clearTimeout(wait);
      const now = performance.now();
      if (reading.id !== noteId()) reading = { id: noteId(), visibleMs: 0, since: now, reachedEnd: false, done: false };
      if (reading.done) return;
      // 숨겨진 동안은 since 가 0 이라 시간이 쌓이지 않는다
      if (reading.since) reading.visibleMs += now - reading.since;
      reading.since = visible() ? now : 0;

      // 새 글을 기다리는 동안 남아 있는 이전 본문(data-pending)은 보지 않는다
      const prose = document.querySelector<HTMLElement>(".reader .prose:not([data-pending])");
      if (prose && prose.offsetHeight > 0 && prose.getBoundingClientRect().bottom <= innerHeight) reading.reachedEnd = true;
      if (!reading.reachedEnd) return;

      const left = minutes() * 60_000 * READ_TIME_RATIO - reading.visibleMs;
      if (left > 0) {
        // 끝에 먼저 닿았으면 남은 시간이 지난 뒤 다시 본다
        if (visible()) wait = setTimeout(checkComplete, left + 50);
        return;
      }
      reading.done = true;
      if (!alreadyCounted(reading.id)) track("note_read_complete", { note: reading.id, seconds: Math.round(reading.visibleMs / 1000) });
    };

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
      checkComplete();
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", checkComplete);
    update();
    return () => {
      removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", checkComplete);
      clearTimeout(wait);
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
