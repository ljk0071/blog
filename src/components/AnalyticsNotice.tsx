import { Show, createSignal, onSettled } from "solid-js";
import { consent, setConsent } from "~/lib/analytics";

/** 아직 고르지 않은 방문자에게 방문 분석을 허용할지 묻는다. 고르기 전에는 아무것도 수집하지 않는다. */
export default function AnalyticsNotice() {
  const [open, setOpen] = createSignal(false);
  onSettled(() => {
    setOpen(consent() === "unset");
  });
  const choose = (granted: boolean) => {
    setConsent(granted);
    setOpen(false);
  };

  return (
    <Show when={open()}>
      <aside class="analytics-notice card" aria-label="방문 분석 동의">
        <p>
          어떤 글이 읽히는지 알고 싶어요. 방문 분석(Google Analytics · PostHog · Clarity)을 허용해 주실래요? <a href="/privacy">자세히 보기</a>
        </p>
        <div class="actions">
          <button type="button" onClick={() => choose(false)}>
            거부
          </button>
          <button type="button" class="primary" onClick={() => choose(true)}>
            허용
          </button>
        </div>
      </aside>
    </Show>
  );
}
