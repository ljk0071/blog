import { Show, createSignal, onSettled } from "solid-js";
import { optedOut, setTrackingAllowed } from "~/lib/analytics";

const SEEN_KEY = "analytics-notice";

/** 첫 방문 때 한 번, 방문 분석을 쓰고 있다는 것과 끄는 방법을 알린다. 답하면 다시 나오지 않는다. */
export default function AnalyticsNotice() {
  const [open, setOpen] = createSignal(false);
  onSettled(() => {
    try {
      // 이미 답했거나 수집하지 않는 브라우저에는 띄우지 않는다
      setOpen(!localStorage.getItem(SEEN_KEY) && !optedOut());
    } catch {
      // 저장소를 못 쓰면 매번 뜨게 되므로 띄우지 않는다
    }
  });
  const close = (allow: boolean) => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 위에서 걸러져 여기까지 오지 않는다
    }
    if (!allow) setTrackingAllowed(false);
    setOpen(false);
  };

  return (
    <Show when={open()}>
      <aside class="analytics-notice card" aria-label="방문 분석 안내">
        <p>
          어떤 글이 읽히는지 알려고 방문 분석(Google Analytics · PostHog · Clarity)을 쓰고 있어요. <a href="/privacy">자세히 보기</a>
        </p>
        <div class="actions">
          <button type="button" onClick={() => close(false)}>
            수집 안 함
          </button>
          <button type="button" class="primary" onClick={() => close(true)}>
            괜찮아요
          </button>
        </div>
      </aside>
    </Show>
  );
}
