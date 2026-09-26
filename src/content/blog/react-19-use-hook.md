---
title: 'React 19의 use() 훅 정리'
description: 'Promise와 Context를 읽는 새로운 use() API의 동작 방식과 Suspense와의 관계를 정리합니다.'
pubDate: 2026-09-10
tags: ['react', 'react-19', 'suspense']
stage: 'budding'
---

React 19에서 추가된 `use()`는 렌더링 중에 **Promise** 또는 **Context**의 값을 읽는 API입니다.

## Promise 읽기

```tsx
import { use, Suspense } from 'react';

function Comments({ promise }: { promise: Promise<string[]> }) {
  const comments = use(promise); // resolve될 때까지 가장 가까운 Suspense로 suspend
  return (
    <ul>
      {comments.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ul>
  );
}

export function Post({ commentsPromise }: { commentsPromise: Promise<string[]> }) {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <Comments promise={commentsPromise} />
    </Suspense>
  );
}
```

## 일반 훅과 다른 점

- 조건문·반복문 **안에서도** 호출할 수 있습니다.
- Promise는 렌더 중에 새로 만들면 매 렌더마다 새 Promise가 되므로, 상위(서버 컴포넌트나 캐시)에서 만들어 내려줘야 합니다. 참조 안정성 이야기는 [useMemo 노트](/blog/usememo-when)와도 이어져요.
- reject된 Promise는 가장 가까운 Error Boundary로 전파됩니다.

## Context 읽기

```tsx
function Heading({ show }: { show: boolean }) {
  if (!show) return null;
  const theme = use(ThemeContext); // early return 이후에도 호출 가능
  return <h1 className={theme}>Hello</h1>;
}
```
