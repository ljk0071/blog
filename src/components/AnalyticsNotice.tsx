import { Show, createSignal, onSettled } from "solid-js";
import { consent, needsConsent, setConsent } from "~/lib/analytics";

/**
 * 아직 고르지 않은 방문자에게 한 번 보여 준다.
 *  - 유럽: 허용할지 묻는다. 고르기 전에는 아무것도 수집하지 않는다.
 *  - 그 밖: 수집 중임을 알리고 끌 수 있게 한다.
 */
export default function AnalyticsNotice() {
  const [mode, setMode] = createSignal<"ask" | "inform" | null>(null);
  onSettled(() => {
    setMode(consent() !== "unset" ? null : needsConsent() ? "ask" : "inform");
  });
  const choose = (granted: boolean) => {
    setConsent(granted);
    setMode(null);
  };

  return (
    <Show when={mode()}>
      {(m) => (
        <aside class="analytics-notice card" aria-label="방문 분석 안내">
          <p>
            {m() === "ask"
              ? "어떤 글이 읽히는지 알고 싶어요. 방문 분석(Google Analytics · PostHog · Clarity)을 허용해 주실래요? "
              : "어떤 글이 읽히는지 알려고 방문 분석(Google Analytics · PostHog · Clarity)을 쓰고 있어요. "}
            <a href="/privacy">자세히 보기</a>
          </p>
          <div class="actions">
            <button type="button" onClick={() => choose(false)}>
              {m() === "ask" ? "거부" : "수집 안 함"}
            </button>
            <button type="button" class="primary" onClick={() => choose(true)}>
              {m() === "ask" ? "허용" : "괜찮아요"}
            </button>
          </div>
        </aside>
      )}
    </Show>
  );
}
