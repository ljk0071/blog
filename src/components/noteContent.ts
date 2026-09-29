/** 오버레이에 보여 줄 글 본문. 정적 글 페이지(/blog/<id>) HTML에서 본문 부분만 꺼내 쓴다. */
export interface NoteContent {
  prose: string;
  /** 백링크·같은 태그 노트 섹션 */
  extra: string;
}

const cache = new Map<string, Promise<NoteContent>>();
const ready = new Map<string, NoteContent>();

/** 이미 받아 둔 본문 (없으면 undefined) — 오버레이 첫 프레임부터 본문을 그리기 위해 동기로 읽는다 */
export const peekNote = (id: string) => ready.get(id);

export function prefetchNote(id: string): Promise<NoteContent> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/blog/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const content = {
          prose: doc.querySelector('article .prose')?.innerHTML ?? '',
          extra: [...doc.querySelectorAll('main > section')].map((s) => s.outerHTML).join(''),
        };
        ready.set(id, content);
        return content;
      });
    // 실패하면 다음에 다시 시도할 수 있게 캐시에서 뺀다
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
