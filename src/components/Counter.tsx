import { useState } from 'react';

// MDX 글 안에서 동작하는 React 데모 컴포넌트
export default function Counter({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  return (
    <div
      className="card"
      style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.9rem 1.25rem', margin: '1.75rem 0' }}
    >
      <button type="button" onClick={() => setCount((c) => c - 1)} aria-label="감소">
        −
      </button>
      <strong style={{ minWidth: '2.5ch', textAlign: 'center', fontSize: '1.3rem', fontFamily: 'var(--serif)' }}>{count}</strong>
      <button type="button" onClick={() => setCount((c) => c + 1)} aria-label="증가">
        +
      </button>
      <span className="hand" style={{ fontSize: '1.3rem' }}>
        ← 눌러보세요! 진짜 React예요
      </span>
    </div>
  );
}
