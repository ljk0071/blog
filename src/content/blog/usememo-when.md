---
title: 'useMemo, 언제 써야 할까? (React Compiler 시대)'
description: 'React Compiler가 자동 메모이제이션을 해주는 지금, 수동 useMemo/useCallback이 여전히 필요한 경우를 살펴봅니다.'
pubDate: 2026-08-28
tags: ['react', 'performance', 'react-compiler']
---

React Compiler는 빌드 타임에 컴포넌트를 분석해 값과 콜백을 자동으로 메모이제이션합니다.
그렇다면 `useMemo`는 이제 필요 없을까요?

## 여전히 수동 메모이제이션이 의미 있는 경우

1. **Compiler를 적용하지 않은 코드베이스** — 점진적 도입 중이라면 기존 규칙이 그대로 유효합니다.
2. **Effect 의존성 안정화** — 외부 라이브러리에 넘기는 객체의 참조 동일성을 명시적으로 보장하고 싶을 때.
3. **Compiler가 bail-out한 컴포넌트** — Rules of React를 위반하면 Compiler는 해당 컴포넌트를 건너뜁니다.

## 측정이 먼저

```tsx
<Profiler id="List" onRender={(id, phase, actualDuration) => console.log(id, phase, actualDuration)}>
  <List items={items} />
</Profiler>
```

감으로 최적화하지 말고 React DevTools Profiler나 `<Profiler>`로 먼저 측정하세요.
