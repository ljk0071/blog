/** 오버레이에 보여 줄 글 본문. 정적 글 페이지(/blog/<id>) HTML에서 본문 부분만 꺼내 쓴다. */
export interface NoteContent {
  prose: string;
  /** 백링크·같은 태그 노트 섹션 */
  extra: string;
}

const cache = new Map<string, Promise<NoteContent>>();

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
        return {
          prose: doc.querySelector('article .prose')?.innerHTML ?? '',
          extra: [...doc.querySelectorAll('main > section')].map((s) => s.outerHTML).join(''),
        };
      });
    // 실패하면 다음에 다시 시도할 수 있게 캐시에서 뺀다
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
