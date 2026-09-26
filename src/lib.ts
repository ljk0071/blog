import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

export async function getPosts() {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

// 터미널 느낌에 맞춰 ISO 형식(YYYY-MM-DD)
export function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// 한국어 기준 대략 분당 500자
export function readingTime(body = '') {
  return Math.max(1, Math.round(body.length / 500));
}

// 글 제목이 목록 ↔ 본문 사이에서 이어지도록 쓰는 view-transition-name
export const titleTransition = (id: string) => `post-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
