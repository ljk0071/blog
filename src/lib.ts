import { getCollection, type CollectionEntry } from 'astro:content';
import type { Stage } from './consts';

export type Post = CollectionEntry<'blog'>;

export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

// 한국어 기준 대략 분당 500자
export function readingTime(body = '') {
  return Math.max(1, Math.round(body.length / 500));
}

/**
 * 목록의 노트 카드 ↔ 글 헤더를 이어 주는 view-transition-name 묶음.
 * 카드 상자는 헤더 영역으로, 단계 표시와 제목은 각각 제자리로 커지며 이동한다.
 */
export const noteTransition = (id: string) => {
  const key = id.replace(/[^a-zA-Z0-9_-]/g, '-');
  return { card: `note-card-${key}`, title: `note-title-${key}`, stage: `note-stage-${key}` };
};

/** 본문에서 다른 글로 가는 내부 링크(/blog/<id>)를 뽑는다 */
export function outgoingLinks(post: Post, ids: Set<string>) {
  const found = new Set<string>();
  for (const m of (post.body ?? '').matchAll(/(?:\]\(|href=["'])\/blog\/([^)"'#?\s]+)/g)) {
    const id = m[1].replace(/\/$/, '');
    if (id !== post.id && ids.has(id)) found.add(id);
  }
  return [...found];
}

/** 이 글을 링크한 글들 */
export function backlinks(post: Post, posts: Post[]) {
  const ids = new Set(posts.map((p) => p.id));
  return posts.filter((p) => outgoingLinks(p, ids).includes(post.id));
}

export interface GraphNode {
  id: string;
  kind: 'post' | 'tag';
  label: string;
  href: string;
  stage?: Stage;
}
export interface GraphLink {
  source: string;
  target: string;
  kind: 'link' | 'tag';
}

/**
 * 글 ↔ 글(본문 링크), 글 ↔ 태그 관계로 정원 지도를 만든다.
 * 글 하나에만 달린 태그는 연결 정보가 없어 지도를 복잡하게만 하므로 뺀다.
 */
export function buildGraph(posts: Post[], minTagPosts = 2) {
  const ids = new Set(posts.map((p) => p.id));
  const tagCount = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const nodes: GraphNode[] = posts.map((p) => ({
    id: `p:${p.id}`,
    kind: 'post',
    label: p.data.title,
    href: `/blog/${p.id}`,
    stage: p.data.stage,
  }));
  const links: GraphLink[] = [];
  const tags = new Set<string>();
  for (const p of posts) {
    for (const t of p.data.tags) {
      if ((tagCount.get(t) ?? 0) < minTagPosts) continue;
      tags.add(t);
      links.push({ source: `p:${p.id}`, target: `t:${t}`, kind: 'tag' });
    }
    for (const to of outgoingLinks(p, ids)) links.push({ source: `p:${p.id}`, target: `p:${to}`, kind: 'link' });
  }
  for (const t of tags) nodes.push({ id: `t:${t}`, kind: 'tag', label: `#${t}`, href: `/tags/${encodeURIComponent(t)}` });
  return { nodes, links };
}

/** 링크 미리보기 카드용 요약 데이터 */
export function previewIndex(posts: Post[]) {
  return posts.map((p) => ({
    id: p.id,
    title: p.data.title,
    description: p.data.description,
    stage: p.data.stage,
    date: formatDate(p.data.pubDate),
  }));
}
export type PreviewItem = ReturnType<typeof previewIndex>[number];
