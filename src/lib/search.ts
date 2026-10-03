import { notes, type NoteMeta } from "./notes";

export type StageFilter = NoteMeta["stage"] | "all";
export const STAGE_FILTERS: StageFilter[] = ["all", "seedling", "budding", "evergreen"];
export const parseStage = (v: unknown): StageFilter => (STAGE_FILTERS.includes(v as StageFilter) ? (v as StageFilter) : "all");

export interface Snippet {
  before: string;
  match: string;
  after: string;
}
export interface Hit {
  note: NoteMeta;
  snippet?: Snippet;
}

type Entry = { id: string; text: string };
let index: Promise<Entry[]> | undefined;

/** 본문 전체 텍스트 색인. 검색을 처음 쓰는 순간에만 별도 청크로 비동기 로드한다. */
export const loadSearchIndex = () => (index ??= import("virtual:search-index").then((m) => m.default));

export const byStage = (stage: StageFilter) => (stage === "all" ? notes : notes.filter((n) => n.stage === stage));

const SNIPPET = 38;

/** 공백으로 나눈 모든 단어가 (제목·설명·태그·본문) 어딘가에 있어야 한다. 제목 > 태그 > 설명 > 본문 순으로 가중치. */
export function runSearch(entries: Entry[], query: string, stage: StageFilter): Hit[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = new Map(entries.map((e) => [e.id, e.text]));
  const hits: (Hit & { score: number })[] = [];
  for (const note of byStage(stage)) {
    const title = note.title.toLowerCase();
    const desc = note.description.toLowerCase();
    const tags = note.tags.join(" ").toLowerCase();
    const body = (text.get(note.id) ?? "").toLowerCase();
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      const s = (title.includes(t) ? 8 : 0) + (tags.includes(t) ? 4 : 0) + (desc.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0);
      if (!s) {
        ok = false;
        break;
      }
      score += s;
    }
    if (!ok) continue;
    let snippet: Snippet | undefined;
    const raw = text.get(note.id) ?? "";
    for (const t of tokens) {
      const i = body.indexOf(t);
      if (i >= 0 && !title.includes(t)) {
        snippet = { before: raw.slice(Math.max(0, i - SNIPPET), i), match: raw.slice(i, i + t.length), after: raw.slice(i + t.length, i + t.length + SNIPPET) };
        break;
      }
    }
    hits.push({ note, snippet, score });
  }
  return hits.sort((a, b) => b.score - a.score || b.note.pubDate.localeCompare(a.note.pubDate));
}
