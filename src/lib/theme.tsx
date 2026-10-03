import { createContext, createSignal, onSettled, useContext, type Accessor, type Element } from "solid-js";

export type Theme = "light" | "dark";

interface ThemeValue {
  /** 서버·첫 렌더에서는 null (문서 쉘의 인라인 스크립트가 먼저 적용한 값을 hydrate 후에 읽는다) */
  theme: Accessor<Theme | null>;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue>();

export function ThemeProvider(props: { children?: Element }) {
  const [theme, setTheme] = createSignal<Theme | null>(null);

  // hydrate 가 끝난 뒤 DOM 에 적용된 테마를 읽는다 (onSettled 에서의 쓰기는 허용된다)
  onSettled(() => {
    setTheme((document.documentElement.dataset.theme as Theme | undefined) ?? "light");
  });

  const toggle = () => {
    const next: Theme = theme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 저장소를 못 쓰는 환경이면 이번 방문에만 적용
    }
    setTheme(next);
  };

  return <ThemeContext value={{ theme, toggle }}>{props.children}</ThemeContext>;
}

export const useTheme = () => useContext(ThemeContext);
