import { httpStatus } from "@solidjs/web";
import PageHead from "~/components/PageHead";

export default function NotFound() {
  // 서버(prerender)에서는 응답 상태를 404 로 선언한다 → 404.html 로 구워진다. 브라우저에서는 아무 일도 하지 않는다.
  httpStatus(404);
  return (
    <main>
      <PageHead title="아직 자라지 않은 페이지" path="/404" noindex />
      <div class="empty">
        <p class="big" aria-hidden="true">
          🕳️🌱
        </p>
        <h1>여긴 아직 아무것도 자라지 않았어요</h1>
        <p class="muted">주소가 바뀌었거나, 아직 심지 않은 노트일 수 있어요.</p>
        <p>
          <a href="/">정원 입구로 돌아가기</a> · <a href="/blog">모든 노트 보기</a>
        </p>
      </div>
    </main>
  );
}
