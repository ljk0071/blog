// 정원 지도: 노트·태그 관계를 만들고, 작은 force 시뮬레이션으로 배치한다. 난수를 쓰지 않아 서버·클라이언트 결과가 같다.
import type { NoteMeta } from "./notes";

export interface GraphNode {
  id: string;
  kind: "post" | "tag";
  label: string;
  href: string;
  stage?: NoteMeta["stage"];
}
export interface GraphEdge {
  a: number;
  b: number;
  /** 글 사이 링크(점선)인가, 글-태그 관계인가 */
  link: boolean;
}

/** 글 하나에만 달린 태그는 연결 정보가 없어 지도를 복잡하게만 하므로 뺀다. */
export function buildGraph(notes: NoteMeta[], minTagNotes = 2) {
  const tagCount = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const tags = [...tagCount].filter(([, c]) => c >= minTagNotes).map(([t]) => t);

  const nodes: GraphNode[] = [
    ...notes.map((n): GraphNode => ({ id: `p:${n.id}`, kind: "post", label: n.title, href: `/blog/${n.id}`, stage: n.stage })),
    ...tags.map((t): GraphNode => ({ id: `t:${t}`, kind: "tag", label: `#${t}`, href: `/tags/${encodeURIComponent(t)}` }))
  ];
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges: GraphEdge[] = [];
  for (const n of notes) {
    const a = index.get(`p:${n.id}`)!;
    for (const t of n.tags) {
      const b = index.get(`t:${t}`);
      if (b !== undefined) edges.push({ a, b, link: false });
    }
    for (const to of n.links) {
      const b = index.get(`p:${to}`);
      if (b !== undefined) edges.push({ a, b, link: true });
    }
  }
  return { nodes, edges };
}

export interface Dims {
  W: number;
  H: number;
  minW: number;
  margin: number;
}
// 넓은 화면은 가로형, 좁은 화면(모바일)은 세로형으로 배치해 글자가 작아지지 않게 한다
export const WIDE: Dims = { W: 640, H: 380, minW: 560, margin: 70 };
export const NARROW: Dims = { W: 360, H: 640, minW: 360, margin: 105 };
export const PAD = 24;

export interface Vec {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** 인덱스 기반(결정적) 초기 배치 */
export function initialPositions(n: number, { W, H }: Dims): Vec[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const r = 18 * Math.sqrt(i + 1);
    return { x: W / 2 + r * Math.cos(i * golden), y: H / 2 + r * Math.sin(i * golden), vx: 0, vy: 0 };
  });
}

/** 반발력 + 링크 스프링 + 중심 인력 한 스텝 */
export function step(pos: Vec[], edges: GraphEdge[], alpha: number, pinned: number | null, { W, H }: Dims, charge: number[]) {
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      const dx = pos[j].x - pos[i].x;
      const dy = pos[j].y - pos[i].y;
      const d2 = Math.max(dx * dx + dy * dy, 64);
      const d = Math.sqrt(d2);
      // 글 노드는 라벨이 길어서 더 강하게 밀어낸다
      const f = (3400 * charge[i] * charge[j] * alpha) / d2;
      pos[i].vx -= (dx / d) * f;
      pos[i].vy -= (dy / d) * f;
      pos[j].vx += (dx / d) * f;
      pos[j].vy += (dy / d) * f;
    }
  }
  for (const { a, b, link } of edges) {
    const rest = link ? 170 : 95;
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
    p.vx += (W / 2 - p.x) * (W > H ? 0.005 : 0.01) * alpha;
    p.vy += (H / 2 - p.y) * (W > H ? 0.01 : 0.005) * alpha;
    p.vx *= 0.6;
    p.vy *= 0.6;
    p.x = Math.min(W - PAD, Math.max(PAD, p.x + p.vx));
    p.y = Math.min(H - PAD, Math.max(PAD, p.y + p.vy));
  }
}

/** 안정화된 배치 (미리 600 스텝) */
export function settle(nodes: GraphNode[], edges: GraphEdge[], dims: Dims) {
  const charge = nodes.map((n) => (n.kind === "post" ? 2.2 : 1));
  const pos = initialPositions(nodes.length, dims);
  for (let t = 0; t < 600; t++) step(pos, edges, 1 - t / 620, null, dims, charge);
  return { pos, charge };
}

/** 안정화된 배치에 딱 맞는 viewBox */
export function fitViewBox(pos: Vec[], dims: Dims, wide: boolean) {
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const m = dims.margin;
  const [x0, x1, y0, y1] = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...ys) - m / 2, Math.max(...ys) + m];
  const w = Math.max(x1 - x0, dims.minW);
  const h = Math.max(y1 - y0, wide ? w * 0.5 : w * 0.8);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
