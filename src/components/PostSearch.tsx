import { useDeferredValue, useMemo, useState } from 'react';

export interface PostSummary {
  id: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  transition: string;
}

export default function PostSearch({ posts }: { posts: PostSummary[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => [p.title, p.description, ...p.tags].some((s) => s.toLowerCase().includes(q)));
  }, [deferred, posts]);

  return (
    <div>
      <label className="grep">
        <span className="prompt">grep -i</span>
        <input
          type="search"
          placeholder='"키워드"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="글 검색"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <p className="muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
        total {filtered.length}
      </p>
      {filtered.length === 0 ? (
        <p>
          <span className="muted">grep: </span>일치하는 글이 없습니다.
        </p>
      ) : (
        <ul className="ls">
          {filtered.map((p) => (
            <li key={p.id}>
              <div className="row">
                <span className="perm">-rw-r--r--</span>
                <time dateTime={p.date}>{p.date}</time>
                <a className="title" href={`/blog/${p.id}`} style={{ viewTransitionName: p.transition }}>
                  {p.title}
                </a>
              </div>
              <p className="desc">{p.description}</p>
              <span className="tags">
                {p.tags.map((t) => (
                  <a key={t} className="tag" href={`/tags/${encodeURIComponent(t)}`}>
                    #{t}
                  </a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .grep { display: flex; align-items: baseline; gap: 0.6rem; border-bottom: 1px solid var(--border); padding: 0.4rem 0; }
        .grep input { flex: 1; min-width: 0; background: transparent; border: 0; outline: none; color: var(--accent); font: inherit; caret-color: var(--accent); }
        .grep input::placeholder { color: var(--muted); }
        .grep:focus-within { border-bottom-color: var(--accent); }
      `}</style>
    </div>
  );
}
