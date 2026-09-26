import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { GraphLink, GraphNode } from '../lib';

const PAD = 24;
type Dims = { W: number; H: number; minW: number; margin: number };
// 넓은 화면은 가로형, 좁은 화면(모바일)은 세로형으로 배치해 글자가 작아지지 않게 한다
const WIDE: Dims = { W: 640, H: 380, minW: 560, margin: 70 };
const NARROW: Dims = { W: 360, H: 640, minW: 360, margin: 55 };

type Vec = { x: number; y: number; vx: number; vy: number };

/** 인덱스 기반(결정적) 초기 배치: SSR과 클라이언트가 같은 결과를 내도록 난수를 쓰지 않는다 */
function initialPositions(n: number, { W, H }: Dims): Vec[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const r = 18 * Math.sqrt(i + 1);
    return { x: W / 2 + r * Math.cos(i * golden), y: H / 2 + r * Math.sin(i * golden), vx: 0, vy: 0 };
  });
}

/** 아주 작은 force 시뮬레이션 한 스텝 (반발력 + 링크 스프링 + 중심 인력) */
function step(pos: Vec[], edges: [number, number, number][], alpha: number, pinned: number | null, { W, H }: Dims) {
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const dx = pos[j].x - pos[i].x;
      const dy = pos[j].y - pos[i].y;
      const d2 = Math.max(dx * dx + dy * dy, 64);
      const f = (3400 * alpha) / d2;
      const d = Math.sqrt(d2);
      pos[i].vx -= (dx / d) * f;
      pos[i].vy -= (dy / d) * f;
      pos[j].vx += (dx / d) * f;
      pos[j].vy += (dy / d) * f;
    }
  }
  for (const [a, b, rest] of edges) {
    const dx = pos[b].x - pos[a].x;
    const dy = pos[b].y - pos[a].y;
    const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const f = (d - rest) * 0.04 * alpha;
    pos[a].vx += (dx / d) * f;
    pos[a].vy += (dy / d) * f;
    pos[b].vx -= (dx / d) * f;
    pos[b].vy -= (dy / d) * f;
  }
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i];
    if (i === pinned) {
      p.vx = p.vy = 0;
      continue;
    }
    // 긴 축 방향으로는 약하게, 짧은 축 방향으로는 강하게 중심으로 당긴다
    p.vx += (W / 2 - p.x) * (W > H ? 0.006 : 0.014) * alpha;
    p.vy += (H / 2 - p.y) * (W > H ? 0.014 : 0.006) * alpha;
    p.vx *= 0.6;
    p.vy *= 0.6;
    p.x = Math.min(W - PAD, Math.max(PAD, p.x + p.vx));
    p.y = Math.min(H - PAD, Math.max(PAD, p.y + p.vy));
  }
}

const STAGE_FILL = { seedling: '#a8d5a2', budding: '#6fae7c', evergreen: '#3f7a52' } as const;
const short = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function GardenGraph({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const index = useMemo(() => new Map(nodes.map((n, i) => [n.id, i])), [nodes]);
  const edges = useMemo(
    () =>
      links
        .filter((l) => index.has(l.source) && index.has(l.target))
        .map((l) => [index.get(l.source)!, index.get(l.target)!, l.kind === 'link' ? 170 : 95] as [number, number, number]),
    [links, index],
  );
  const neighbors = useMemo(() => {
    const m = nodes.map(() => new Set<number>());
    for (const [a, b] of edges) {
      m[a].add(b);
      m[b].add(a);
    }
    return m;
  }, [nodes, edges]);

  // SSR은 가로형으로 렌더링하고, hydrate 후 좁은 화면이면 세로형으로 다시 배치한다
  const [dims, setDims] = useState<Dims>(WIDE);
  const figRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if ((figRef.current?.clientWidth ?? 1000) < 560) setDims(NARROW);
  }, []);

  // 미리 안정화시킨 배치 → 첫 화면부터 정돈된 그래프 (결정적이라 SSR과 hydrate 결과가 같다)
  const settled = useMemo(() => {
    const pos = initialPositions(nodes.length, dims);
    for (let t = 0; t < 400; t++) step(pos, edges, 1 - t / 420, null, dims);
    return pos;
  }, [nodes, edges, dims]);

  // 안정화된 배치에 딱 맞게 확대(viewBox fit) → 노드가 적어도 화면을 꽉 채운다
  const viewBox = useMemo(() => {
    const xs = settled.map((p) => p.x);
    const ys = settled.map((p) => p.y);
    const m = dims.margin;
    let [x0, x1, y0, y1] = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...ys) - m / 2, Math.max(...ys) + m];
    // 너무 확대되지 않도록 최소 크기 보장 (가로:세로 ≈ 16:9)
    const w = Math.max(x1 - x0, dims.minW);
    const h = Math.max(y1 - y0, dims === WIDE ? w * 0.5 : w * 0.8);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [settled, dims]);

  const posRef = useRef(settled);
  const lastSettled = useRef(settled);
  if (lastSettled.current !== settled) {
    // 배치가 바뀌면(가로형 → 세로형) 현재 위치도 새 배치로 교체
    lastSettled.current = settled;
    posRef.current = settled;
  }
  const [, setFrame] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ i: number; moved: boolean } | null>(null);
  const raf = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const reheat = () => {
    cancelAnimationFrame(raf.current);
    let alpha = 0.5;
    const tick = () => {
      step(posRef.current, edges, alpha, drag.current?.i ?? null, dims);
      setFrame((f) => f + 1);
      alpha *= drag.current ? 1 : 0.97;
      if (alpha > 0.02) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const toSvg = (e: RPointerEvent) => {
    const m = svgRef.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: p.x, y: p.y };
  };

  const onPointerDown = (i: number) => (e: RPointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { i, moved: false };
  };
  const onPointerMove = (e: RPointerEvent) => {
    if (!drag.current) return;
    const { x, y } = toSvg(e);
    const p = posRef.current[drag.current.i];
    if (!drag.current.moved && Math.hypot(x - p.x, y - p.y) < 3) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      reheat();
    }
    p.x = Math.min(dims.W - PAD, Math.max(PAD, x));
    p.y = Math.min(dims.H - PAD, Math.max(PAD, y));
  };
  const endDrag = () => {
    const wasDragging = drag.current?.moved;
    if (wasDragging) setTimeout(() => (drag.current = null), 0);
    else drag.current = null;
  };

  const pos = posRef.current;
  const active = hover ?? null;
  const isLit = (i: number) => active === null || i === active || neighbors[active].has(i);

  return (
    <figure ref={figRef} className="garden-graph card" data-no-preview>
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        role="img"
        aria-label="노트와 태그의 연결 지도"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {edges.map(([a, b, rest], k) => (
          <line
            key={k}
            x1={pos[a].x}
            y1={pos[a].y}
            x2={pos[b].x}
            y2={pos[b].y}
            className={rest > 100 ? 'e link' : 'e'}
            opacity={active === null || a === active || b === active ? 1 : 0.15}
          />
        ))}
        {nodes.map((n, i) => {
          const post = n.kind === 'post';
          return (
            <a
              key={n.id}
              href={n.href}
              className={`n ${n.kind}`}
              style={{ opacity: isLit(i) ? 1 : 0.25 }}
              onPointerDown={onPointerDown(i)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={(e) => {
                if (drag.current?.moved) e.preventDefault();
              }}
            >
              <title>{n.label}</title>
              <circle
                cx={pos[i].x}
                cy={pos[i].y}
                r={post ? (i === active ? 12 : 9) : 4.5}
                fill={post ? STAGE_FILL[n.stage ?? 'seedling'] : 'var(--muted)'}
              />
              <text x={pos[i].x} y={pos[i].y + (post ? 24 : 16)} textAnchor="middle">
                {post ? (i === active ? n.label : short(n.label)) : n.label}
              </text>
            </a>
          );
        })}
      </svg>
      <figcaption>
        <span className="legend">
          <i style={{ background: STAGE_FILL.seedling }} /> 새싹 <i style={{ background: STAGE_FILL.budding }} /> 자라는 중{' '}
          <i style={{ background: STAGE_FILL.evergreen }} /> 상록수 <i className="tagdot" /> 태그 <b className="linkline" /> 글 사이 링크
        </span>
      </figcaption>
      <style>{`
        .garden-graph { margin: 0; padding: 0.5rem; overflow: hidden; }
        .garden-graph svg { display: block; width: 100%; height: auto; touch-action: none; user-select: none; }
        .garden-graph .e { stroke: var(--border); stroke-width: 1.5; transition: opacity .2s; }
        .garden-graph .e.link { stroke: var(--accent); stroke-dasharray: 5 4; stroke-width: 1.75; }
        .garden-graph .n { cursor: grab; transition: opacity .2s; background: none; }
        .garden-graph .n:active { cursor: grabbing; }
        .garden-graph .n circle { stroke: var(--card); stroke-width: 2.5; transition: r .15s; }
        .garden-graph .n text { font-size: 12px; fill: var(--fg); paint-order: stroke; stroke: var(--card); stroke-width: 4px; stroke-linejoin: round; pointer-events: none; }
        .garden-graph .n.post text { font-family: var(--serif); font-weight: 700; font-size: 13px; }
        .garden-graph .n.tag text { fill: var(--muted); font-size: 11px; }
        .garden-graph .n:focus-visible { outline: none; }
        @media (max-width: 600px) {
          .garden-graph .n.post text { font-size: 20px; }
          .garden-graph .n.tag text { font-size: 17px; }
        }
        .garden-graph .n:focus-visible circle { stroke: var(--accent); stroke-width: 3; }
        .garden-graph figcaption { padding: 0.25rem 0.75rem 0.5rem; font-size: 0.8rem; color: var(--muted); }
        .garden-graph .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
        .garden-graph .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 0.5rem; }
        .garden-graph .legend .tagdot { width: 7px; height: 7px; background: var(--muted); }
        .garden-graph .legend .linkline { display: inline-block; width: 18px; border-top: 2px dashed var(--accent); margin-left: 0.5rem; }
      `}</style>
    </figure>
  );
}
