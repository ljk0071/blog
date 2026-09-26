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
        padding: '1rem',
        border: '1px dashed var(--border)',
        borderRadius: 8,
        margin: '1.5rem 0',
      }}
    >
      <button type="button" onClick={() => setCount((c) => c - 1)}>−</button>
      <strong style={{ minWidth: '2ch', textAlign: 'center' }}>{count}</strong>
      <button type="button" onClick={() => setCount((c) => c + 1)}>+</button>
      <span className="muted">← 실제로 hydrate된 React 컴포넌트입니다</span>
    </div>
  );
}
