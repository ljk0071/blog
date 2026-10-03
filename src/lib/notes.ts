import { query } from "@solidjs/router";
import { bodies } from "virtual:note-bodies";
import { notes, type NoteMeta } from "virtual:notes";

export { notes, type NoteMeta };

export const noteById = new Map(notes.map((n) => [n.id, n]));

/** 본문 HTML. 노트마다 별도 청크라서, 라우터가 링크 hover/focus 때 preload 하면 클릭 시점엔 이미 도착해 있다. */
export const getNoteBody = query(async (id: string) => {
  const load = bodies[id];
  if (!load) throw new Error(`노트를 찾을 수 없어요: ${id}`);
  return (await load()).default;
}, "note-body");

/** 이 노트를 본문에서 링크한 노트들 */
export const backlinksOf = (id: string) => notes.filter((n) => n.links.includes(id));

/** 같은 태그를 가진 다른 노트 (백링크 제외) */
export const relatedOf = (note: NoteMeta, limit = 2) => {
  const back = new Set(backlinksOf(note.id).map((n) => n.id));
  return notes
    .filter((n) => n.id !== note.id && !back.has(n.id) && n.tags.some((t) => note.tags.includes(t)))
    .slice(0, limit);
};

export const tagCounts = (() => {
  const counts = new Map<string, number>();
  for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
})();

export const notesByTag = (tag: string) => notes.filter((n) => n.tags.includes(tag));

/** 한국어 날짜 표기 (UTC 기준 YYYY-MM-DD 문자열을 그대로 풀어쓴다) */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
};
