/** <Errored> 의 fallback. reset 은 "실패한 가지를 다시 시도"하는 액션이다. */
export default function ErrorCard(props: { error: unknown; onRetry: () => void }) {
  return (
    <main>
      <div class="error-card card" role="alert">
        <p class="big" aria-hidden="true" style={{ "font-size": "2.2rem", margin: 0 }}>
          🥀
        </p>
        <h2>앗, 이 화면을 불러오지 못했어요</h2>
        <p>{props.error instanceof Error && props.error.message ? props.error.message : "네트워크 상태를 확인하고 다시 시도해 주세요."}</p>
        <button type="button" onClick={() => props.onRetry()}>
          다시 시도
        </button>
      </div>
    </main>
  );
}
