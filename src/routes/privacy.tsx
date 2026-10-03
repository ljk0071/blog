import { Show, createSignal, onSettled } from "solid-js";
import PageHead from "~/components/PageHead";
import { consent, setConsent } from "~/lib/analytics";

export default function Privacy() {
  // 서버·첫 렌더에서는 알 수 없다 → hydrate 후에 이 브라우저의 선택을 읽는다
  const [on, setOn] = createSignal<boolean | null>(null);
  onSettled(() => {
    setOn(consent() === "granted");
  });
  const toggle = () => {
    const next = !on();
    setOn(next);
    setConsent(next);
  };

  return (
    <main>
      <PageHead title="방문 분석 안내" description="이 정원이 방문 기록을 어떻게 수집하고, 어떻게 끌 수 있는지 안내합니다." path="/privacy" />
      <p class="hand">정원에 남는 발자국</p>
      <h1>방문 분석 안내</h1>
      <p>
        어떤 글이 읽히는지, 어디서 막히는지 알고 싶어서 방문 분석 도구 세 가지를 쓰고 있어요. 허용한 브라우저에서만 수집하고, 이름·이메일 같은 정보는 받지 않으며, 광고에도 쓰지 않습니다. 아래 스위치로 언제든 바꿀 수 있어요.
      </p>

      <div class="privacy-switch card">
        <div>
          <strong>이 브라우저의 방문 분석</strong>
          <p class="muted small" aria-live="polite">
            <Show when={on() !== null} fallback="설정을 확인하는 중…">
              {on() ? "켜져 있어요." : "꺼져 있어요. 이 브라우저의 방문은 기록되지 않습니다."}
            </Show>
          </p>
        </div>
        <button type="button" onClick={toggle} disabled={on() === null}>
          {on() ? "끄기" : "허용하기"}
        </button>
      </div>
      <p class="muted small">이 선택은 이 브라우저에만 저장돼요. 다른 기기나 브라우저에서는 따로 고르게 됩니다.</p>

      <h2>무엇을 수집하나요</h2>
      <table>
        <thead>
          <tr>
            <th>도구</th>
            <th>수집하는 것</th>
            <th>쓰는 이유</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Google Analytics 4</td>
            <td>본 페이지, 들어온 경로(검색·링크), 브라우저·기기 종류, 대략적인 지역</td>
            <td>방문 수와 유입 경로 파악</td>
          </tr>
          <tr>
            <td>PostHog</td>
            <td>연 노트, 끝까지 읽었는지, 북마크·테마 전환, 정원 안에서 입력한 검색어, 페이지 속도, 스크립트 오류</td>
            <td>어떤 글이 읽히는지, 오류와 느린 화면 찾기</td>
          </tr>
          <tr>
            <td>Microsoft Clarity</td>
            <td>클릭·스크롤·마우스 움직임을 재생할 수 있는 화면 기록</td>
            <td>쓰기 불편한 곳 찾기</td>
          </tr>
        </tbody>
      </table>

      <h2>알아 두면 좋은 점</h2>
      <ul>
        <li>세 도구는 방문자를 구분하려고 쿠키나 브라우저 저장소에 무작위 식별자를 저장해요. 누구인지는 알 수 없고, 같은 브라우저인지만 구분합니다.</li>
        <li>IP 주소로 추정한 국가·도시 수준의 위치가 함께 기록돼요.</li>
        <li>기록은 Google, PostHog, Microsoft 의 서버(주로 미국)에 저장되고, 각 서비스의 보존 기간이 지나면 지워져요.</li>
        <li>읽기 진행도와 북마크는 분석과 별개로 이 브라우저 안에만 저장되고 어디로도 보내지 않아요.</li>
      </ul>
      <p class="muted small">
        수집된 기록의 삭제를 원하거나 궁금한 점이 있으면 <a href="https://github.com/ljk0071/blog/issues" target="_blank" rel="noopener">GitHub 이슈</a>로 알려 주세요.
      </p>
    </main>
  );
}
