import { useIsRouting, useLocation } from "@solidjs/router";
import { clientOnly } from "@solidjs/web";
import { Errored, createEffect, onSettled, type ParentComponent } from "solid-js";
import { initAnalytics, trackPageView } from "~/lib/analytics";
import { BookmarksProvider } from "~/lib/bookmarks";
import { ProgressProvider } from "~/lib/progress";
import { ThemeProvider } from "~/lib/theme";
import ErrorCard from "./ErrorCard";
import Footer from "./Footer";
import Header from "./Header";

// 링크 미리보기는 브라우저 전용(document 이벤트 위임)이라 서버에서는 코드를 실행하지 않는다.
const LinkPreview = clientOnly(() => import("./LinkPreview"));

/** 모든 페이지를 감싸는 루트 레이아웃. 컨텍스트 제공자 → 헤더 → (에러 경계) 페이지 → 푸터. */
const Shell: ParentComponent = (props) => {
  const isRouting = useIsRouting();
  const location = useLocation();

  // hydrate 가 끝난 뒤에 분석 도구를 켠다 (첫 렌더·SEO HTML 에는 영향이 없다)
  onSettled(initAnalytics);
  // 경로가 바뀔 때마다 페이지뷰 (SPA 라서 직접 보내야 한다). 검색어(?q=) 만 바뀌는 건 같은 페이지로 본다.
  createEffect(
    () => location.pathname,
    (path) => {
      // 라우터가 <title> 을 갱신한 다음 프레임에 보내야 새 제목이 실린다
      const id = requestAnimationFrame(() => trackPageView(path));
      return () => cancelAnimationFrame(id);
    }
  );
  return (
    <ThemeProvider>
      <BookmarksProvider>
        <ProgressProvider>
          <div class="app-root">
            {/* 새 페이지·데이터를 기다리는 동안(라우터가 이전 화면을 붙잡고 있는 동안) 맨 위에 진행 막대 */}
            <div class="route-progress" data-active={isRouting() ? "" : undefined} aria-hidden="true" />
            <Header />
            <Errored fallback={(err, reset) => <ErrorCard error={err()} onRetry={reset} />}>{props.children}</Errored>
            <Footer />
            <LinkPreview fallback={null} />
          </div>
        </ProgressProvider>
      </BookmarksProvider>
    </ThemeProvider>
  );
};

export default Shell;
