import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) ?? 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
    setTheme(next);
  };

  return (
    <button type="button" onClick={toggle} aria-label="테마 전환" title={theme === 'dark' ? '낮의 정원' : '밤의 정원'}>
      {theme === null ? ' ' : theme === 'dark' ? '☀︎' : '☾'}
    </button>
  );
}
