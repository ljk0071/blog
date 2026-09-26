import { useDeferredValue, useMemo, useState } from 'react';

export interface PostSummary {
  id: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
}

export default function PostSearch({ posts }: { posts: PostSummary[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      [p.title, p.description, ...p.tags].some((s) => s.toLowerCase().includes(q)),
    );
  }, [deferred, posts]);

  return (
    <div>
      <input
        type="search"
        placeholder="제목, 설명, 태그로 검색…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="글 검색"
        style={{
          width: '100%',
          padding: '0.6rem 0.8rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--fg)',
          font: 'inherit',
          marginBottom: '1.5rem',
        }}
      />
      {filtered.length === 0 ? (
        <p className="muted">검색 결과가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filtered.map((p) => (
            <li key={p.id} style={{ marginBottom: '1.75rem' }}>
              <a href={`/blog/${p.id}`} style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {p.title}
              </a>
              <p style={{ margin: '0.25rem 0' }}>{p.description}</p>
              <div className="muted" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{p.date}</span>
                {p.tags.map((t) => (
                  <a key={t} className="tag" href={`/tags/${encodeURIComponent(t)}`}>
                    #{t}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
