import { Show, createSignal, onSettled } from "solid-js";
import { STAGES } from "~/consts";
import { formatDate, noteById, type NoteMeta } from "~/lib/notes";

interface State {
  note: NoteMeta;
  x: number;
  y: number;
  below: boolean;
}

const CARD_W = 320;

/**
 * 본문 속 다른 노트로 가는 링크(/blog/...)에 마우스를 올리거나 포커스하면 미리보기 카드를 띄운다.
 * 링크마다 컴포넌트를 두지 않고 document 이벤트 위임 하나로 처리한다. 노트 카드 목록과 터치 입력은 제외.
 * 브라우저 전용이라 clientOnly 로 불러온다(서버는 코드를 실행하지 않는다).
 */
export default function LinkPreview() {
  const [state, setState] = createSignal<State | null>(null);

  onSettled(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLAnchorElement | null = null;

    const anchorOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLAnchorElement>("a[href^='/blog/']") : null);

    const show = (a: HTMLAnchorElement) => {
      if (a.closest(".note, .garden-graph, .reader-backdrop")) return;
      const id = new URL(a.href).pathname.replace(/^\/blog\//, "").replace(/\/$/, "");
      const note = noteById.get(id);
      if (!note || location.pathname === `/blog/${id}`) return;
      const r = a.getBoundingClientRect();
      const half = Math.min(CARD_W, innerWidth - 32) / 2;
      const below = r.top < 200;
      setState({
        note,
        x: Math.min(innerWidth - 16 - half, Math.max(16 + half, r.left + r.width / 2)),
        y: below ? r.bottom + 10 : r.top - 10,
        below
      });
    };
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setState(null);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const a = anchorOf(e.target);
      if (!a || a === current) return;
      current = a;
      clearTimeout(timer);
      timer = setTimeout(() => show(a), 250);
    };
    const onOut = (e: PointerEvent) => {
      const a = anchorOf(e.target);
      if (a && !a.contains(e.relatedTarget as Node | null)) hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const a = anchorOf(e.target);
      if (a) show(a);
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    addEventListener("scroll", hide, { passive: true });
    addEventListener("popstate", hide);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      removeEventListener("scroll", hide);
      removeEventListener("popstate", hide);
    };
  });

  return (
    <Show when={state()}>
      {(s) => (
        <div
          role="tooltip"
          class="link-preview card"
          style={{
            left: `${s().x}px`,
            top: `${s().y}px`,
            width: `min(${CARD_W}px, calc(100vw - 32px))`,
            transform: `translate(-50%, ${s().below ? "0" : "-100%"})`
          }}
        >
          <span class="stage">
            {STAGES[s().note.stage].emoji} {STAGES[s().note.stage].label} · {formatDate(s().note.pubDate)}
          </span>
          <strong>{s().note.title}</strong>
          <p>{s().note.description}</p>
        </div>
      )}
    </Show>
  );
}
