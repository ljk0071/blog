import { useIsRouting } from "@solidjs/router";
import { clientOnly } from "@solidjs/web";
import { Errored, type ParentComponent } from "solid-js";
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
