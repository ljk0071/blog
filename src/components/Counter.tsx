import { useState } from 'react';

// MDX 글 안에서 동작하는 React 데모 컴포넌트
export default function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '0.75rem 1rem',
        border: '1px dashed var(--border)',
        margin: '1.5rem 0',
      }}
    >
      <span className="muted">count =</span>
      <button type="button" onClick={() => setCount((c) => c - 1)} aria-label="감소">
        -
      </button>
      <strong style={{ minWidth: '3ch', textAlign: 'center', color: 'var(--accent)', textShadow: 'var(--glow)' }}>
        {count}
      </strong>
      <button type="button" onClick={() => setCount((c) => c + 1)} aria-label="증가">
        +
      </button>
      <span className="muted" style={{ fontSize: '0.8rem' }}>
        {'// 실제로 hydrate된 React 컴포넌트'}
      </span>
    </div>
  );
}
