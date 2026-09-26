import { useDeferredValue, useMemo, useState } from 'react';
import { STAGES, type Stage } from '../consts';

export interface PostSummary {
  id: string;
  title: string;
  description: string;
  date: string;
  iso: string;
  tags: string[];
  stage: Stage;
  transition: string;
}

const FILTERS: (Stage | 'all')[] = ['all', 'seedling', 'budding', 'evergreen'];

export default function PostSearch({ posts }: { posts: PostSummary[] }) {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (stage === 'all' || p.stage === stage) &&
        (!q || [p.title, p.description, ...p.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [deferred, stage, posts]);

  return (
    <div>
      <div className="search-bar">
        <input
          type="search"
          placeholder="🔍 제목, 설명, 태그로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="노트 검색"
          autoComplete="off"
        />
        <div className="filters" role="group" aria-label="성장 단계 필터">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={stage === f} onClick={() => setStage(f)}>
              {f === 'all' ? '전체' : `${STAGES[f].emoji} ${STAGES[f].label}`}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="hand">아직 이런 씨앗은 심지 않았어요 🌱</p>
      ) : (
        <ul className="notes" data-no-preview>
          {filtered.map((p) => (
            <li key={p.id}>
              <article className="note card">
                <span className="stage" title={STAGES[p.stage].hint}>
                  {STAGES[p.stage].emoji} {STAGES[p.stage].label}
                </span>
                <a className="title" href={`/blog/${p.id}`} style={{ viewTransitionName: p.transition }}>
                  {p.title}
                </a>
                <p className="desc">{p.description}</p>
                <div className="meta">
                  <time dateTime={p.iso}>{p.date}</time>
                  {p.tags.map((t) => (
                    <a key={t} className="tag" href={`/tags/${encodeURIComponent(t)}`}>
                      #{t}
                    </a>
                  ))}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        .search-bar { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
        .search-bar input { width: 100%; font: inherit; padding: 0.7rem 1.1rem; border-radius: 999px; border: 1px solid var(--border); background: var(--card); color: var(--fg); box-shadow: var(--shadow); }
        .search-bar input:focus { outline: 2px solid var(--accent-soft); border-color: var(--accent); }
        .filters { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .filters button { font-size: 0.85rem; }
        .filters button[aria-pressed='true'] { background: var(--accent); border-color: var(--accent); color: var(--card); }
      `}</style>
    </div>
  );
}
