import { useEffect, useState } from 'react';

export interface Line {
  cmd: string;
  out: string;
}

const TYPE_MS = 45;
const PAUSE_MS = 400;

/**
 * 터미널에 명령을 입력하는 것처럼 한 줄씩 타이핑한다.
 * SSR 시에는 전체 텍스트를 렌더링하고(SEO·JS 미실행 대응),
 * hydrate 후 모션 줄이기 설정이 아니면 처음부터 다시 타이핑한다.
 */
export default function Typewriter({ lines }: { lines: Line[] }) {
  const ends = lines.map((_, i) => lines.slice(0, i + 1).reduce((n, l) => n + l.cmd.length, 0));
  const total = ends.at(-1) ?? 0;
  const [typed, setTyped] = useState(total);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setTyped(n);
      if (n >= total) return;
      n += 1;
      // 명령을 다 친 직후엔 실행 결과가 나오는 느낌으로 잠깐 멈춘다
      timer = setTimeout(tick, ends.includes(n - 1) ? PAUSE_MS : TYPE_MS);
    };
    tick();
    return () => clearTimeout(timer);
  }, [total]);

  const done = typed >= total;
  const activeLine = ends.findIndex((end) => typed < end);

  return (
    <div className="typewriter">
      {/* 스크린 리더에는 타이핑 과정 대신 완성된 텍스트를 제공 */}
      <div className="sr-only">
        {lines.map((l) => (
          <p key={l.cmd}>
            $ {l.cmd} — {l.out}
          </p>
        ))}
      </div>
      <div aria-hidden="true">
        {lines.map((l, i) => {
          const start = ends[i] - l.cmd.length;
          if (i > 0 && typed < start) return null;
          const complete = typed >= ends[i];
          return (
            <div key={l.cmd}>
              <p className={`prompt${i === activeLine ? ' cursor' : ''}`}>
                <span className="cmd">{l.cmd.slice(0, typed - start)}</span>
              </p>
              {complete && <p className="out">{l.out}</p>}
            </div>
          );
        })}
        {done && <p className="prompt cursor" />}
      </div>
      <style>{`
        .typewriter { min-height: 13em; }
        .typewriter p { margin: 0; }
        .typewriter .cmd { color: var(--fg); }
        .typewriter .out { color: var(--accent); text-shadow: var(--glow); margin-bottom: 0.75rem; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      `}</style>
    </div>
  );
}
