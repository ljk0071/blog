import { usePreloadRoute, useNavigate } from "@solidjs/router";
import { For, createMemo, createSignal, createStore, onSettled } from "solid-js";
import { notes } from "~/lib/notes";
import { NARROW, PAD, WIDE, buildGraph, fitViewBox, settle, step, type Dims } from "~/lib/graph";

const STAGE_FILL = { seedling: "#a8d5a2", budding: "#6fae7c", evergreen: "#3f7a52" } as const;
const short = (s: string, n = 13) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * 노트와 태그의 연결 지도.
 *  - 위치는 `createStore(fn, seed)` 파생 스토어: 안정화된 배치(settled)가 바뀌면(가로형 ↔ 세로형) 자동으로 다시 파생되고,
 *    드래그 중에는 같은 스토어에 draft 로 직접 쓴다(점마다 세밀하게 갱신).
 *  - 초기 배치는 결정적이라 서버가 그린 SVG 와 hydrate 결과가 같다.
 */
export default function GardenGraph() {
  const navigate = useNavigate();
  const preload = usePreloadRoute();
  const graph = buildGraph(notes);
  const nodes = graph.nodes;
  const edges = graph.edges;
  const neighbors = nodes.map(() => new Set<number>());
  for (const { a, b } of edges) {
    neighbors[a].add(b);
    neighbors[b].add(a);
  }

  // 서버와 첫 렌더는 가로형. hydrate 후 컨테이너가 좁으면 세로형으로 다시 배치한다.
  const [dims, setDims] = createSignal<Dims>(WIDE);
  const settled = createMemo(() => settle(nodes, edges, dims()));
  const viewBox = createMemo(() => fitViewBox(settled().pos, dims(), dims() === WIDE));
  const [pos, setPos] = createStore<{ x: number; y: number }[]>(() => settled().pos.map(({ x, y }) => ({ x, y })), []);

  const [hover, setHover] = createSignal<number | null>(null);
  const lit = (i: number) => hover() === null || i === hover() || neighbors[hover()!].has(i);

  let fig!: HTMLElement;
  let svg!: SVGSVGElement;
  let raf = 0;
  let drag: { i: number; moved: boolean } | null = null;

  onSettled(() => {
    if (fig.clientWidth < 560) setDims(NARROW);
    return () => cancelAnimationFrame(raf);
  });

  const reheat = () => {
    cancelAnimationFrame(raf);
    const sim = pos.map((p) => ({ x: p.x, y: p.y, vx: 0, vy: 0 }));
    let alpha = 0.5;
    const tick = () => {
      step(sim, edges, alpha, drag?.i ?? null, dims(), settled().charge);
      setPos((d) => {
        sim.forEach((p, i) => {
          d[i].x = p.x;
          d[i].y = p.y;
        });
      });
      alpha *= drag ? 1 : 0.97;
      if (alpha > 0.02) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return sim;
  };

  let sim: ReturnType<typeof reheat> | undefined;
  const toSvg = (e: PointerEvent) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const onDown = (i: number, e: PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { i, moved: false };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    const { x, y } = toSvg(e);
    const p = pos[drag.i];
    if (!drag.moved && Math.hypot(x - p.x, y - p.y) < 3) return;
    if (!drag.moved) {
      drag.moved = true;
      sim = reheat();
    }
    const { W, H } = dims();
    const nx = Math.min(W - PAD, Math.max(PAD, x));
    const ny = Math.min(H - PAD, Math.max(PAD, y));
    if (sim) {
      sim[drag.i].x = nx;
      sim[drag.i].y = ny;
    }
    setPos((d) => {
      d[drag!.i].x = nx;
      d[drag!.i].y = ny;
    });
  };
  const endDrag = () => {
    if (drag?.moved) setTimeout(() => (drag = null), 0);
    else drag = null;
  };

  return (
    <figure class="garden-graph card" ref={fig}>
      <svg
        ref={svg}
        viewBox={`${viewBox().x} ${viewBox().y} ${viewBox().w} ${viewBox().h}`}
        role="img"
        aria-label="노트와 태그의 연결 지도"
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <For each={edges}>
          {(e) => (
            <line
              x1={pos[e.a].x}
              y1={pos[e.a].y}
              x2={pos[e.b].x}
              y2={pos[e.b].y}
              class={["e", { link: e.link }]}
              style={{ opacity: hover() === null || e.a === hover() || e.b === hover() ? 1 : 0.15 }}
            />
          )}
        </For>
        <For each={nodes}>
          {(n, i) => (
            // SVG 안의 <a> 는 컴포넌트 콜백 안에서 만들면 HTML 네임스페이스가 돼 버려서(컴파일러가 svg 문맥을 모른다),
            // svg 전용 태그인 <g> 를 링크 역할(role="link")로 쓰고 라우터로 직접 이동한다.
            <g
              role="link"
              tabindex="0"
              aria-label={n.label}
              class={["n", n.kind]}
              style={{ opacity: lit(i()) ? 1 : 0.25 }}
              onPointerDown={(e: PointerEvent) => onDown(i(), e)}
              onPointerEnter={() => {
                setHover(i());
                preload(n.href);
              }}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i())}
              onBlur={() => setHover(null)}
              onClick={() => {
                if (!drag?.moved) navigate(n.href);
              }}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(n.href);
                }
              }}
            >
              <title>{n.label}</title>
              <circle
                cx={pos[i()].x}
                cy={pos[i()].y}
                r={n.kind === "post" ? (i() === hover() ? 12 : 9) : 4.5}
                fill={n.kind === "post" ? STAGE_FILL[n.stage ?? "seedling"] : "var(--muted)"}
              />
              <text x={pos[i()].x} y={pos[i()].y + (n.kind === "post" ? 24 : 16)} text-anchor="middle">
                {n.kind === "post" ? short(n.label.split(":")[0], i() === hover() ? 28 : 13) : n.label}
              </text>
            </g>
          )}
        </For>
      </svg>
      <figcaption>
        <span class="legend">
          <i style={{ background: STAGE_FILL.seedling }} /> 새싹 <i style={{ background: STAGE_FILL.budding }} /> 자라는 중{" "}
          <i style={{ background: STAGE_FILL.evergreen }} /> 상록수 <i class="tagdot" /> 태그 <b class="linkline" /> 글 사이 링크
        </span>
      </figcaption>
    </figure>
  );
}
