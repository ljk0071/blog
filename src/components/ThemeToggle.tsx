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
    <button
      type="button"
      onClick={toggle}
      aria-label="테마 전환"
      style={{
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.25rem 0.6rem',
        cursor: 'pointer',
        color: 'var(--fg)',
        minWidth: 40,
      }}
    >
      {theme === null ? ' ' : theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
