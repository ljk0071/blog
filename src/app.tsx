import "@fontsource/pretendard/400.css";
import "@fontsource/pretendard/600.css";
import "@fontsource/gowun-batang/400.css";
import "@fontsource/gowun-batang/700.css";
import "@fontsource/nanum-pen-script/400.css";
import "@fontsource/jetbrains-mono/400.css";
import "./styles/global.css";
import "./styles/app.css";

import { createRouter, defineRoute, defineRoutes } from "@solidjs/router";
import { lazy } from "solid-js";
import Shell from "~/components/Shell";
import { getNoteBody, notes, tagCounts } from "~/lib/notes";

// 라우트 컴포넌트는 lazy 로 분할한다. 라우터가 링크 hover/focus 때 코드와 preload 를 미리 데워서 클릭 시점엔 이미 준비돼 있다.
const routes = defineRoutes([
  defineRoute({ path: "/", component: lazy(() => import("./routes/home")) }),
  defineRoute({ path: "/blog", component: lazy(() => import("./routes/notes")) }),
  defineRoute({
    path: "/blog/:id",
    // 존재하는 노트 id 만 이 라우트에 매칭된다 → 나머지는 아래 404 로 떨어진다
    matchFilters: { id: notes.map((n) => n.id) },
    component: lazy(() => import("./routes/note")),
    preload: ({ params }) => void getNoteBody(params.id)
  }),
  defineRoute({ path: "/tags", component: lazy(() => import("./routes/tags")) }),
  defineRoute({
    path: "/tags/:tag",
    matchFilters: { tag: tagCounts.map(([tag]) => tag) },
    component: lazy(() => import("./routes/tag"))
  }),
  defineRoute({ path: "/saved", component: lazy(() => import("./routes/saved")) }),
  defineRoute({ path: "/about", component: lazy(() => import("./routes/about")) }),
  defineRoute({ path: "*404", component: lazy(() => import("./routes/not-found")) })
]);

const Router = createRouter({ routes });

export default function App() {
  return <Router>{(props) => <Shell>{props.children}</Shell>}</Router>;
}
