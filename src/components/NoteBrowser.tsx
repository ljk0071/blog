import { AnimatePresence, LayoutGroup, LazyMotion, MotionConfig } from 'motion/react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, type Stage } from '../consts';
import type { NoteSummary } from '../lib';
import NoteCard from './NoteCard';
import NoteOverlay from './NoteOverlay';
import { prefetchNote } from './noteContent';

declare global {
  interface Window {
    /** BaseHead의 popstate 훅이 호출. true를 반환하면 ClientRouter로 전파하지 않는다 */
    __notePopState?: (e: PopStateEvent) => boolean;
  }
}

type Filter = Stage | 'all';
const loadFeatures = () => import('./motionFeatures').then((r) => r.default);
const FILTERS: Filter[] = ['all', 'seedling', 'budding', 'evergreen'];

interface Props {
  notes: NoteSummary[];
  /** 검색창·성장 단계 필터 표시 (/blog) */
  search?: boolean;
  siteTitle: string;
}

/**
 * 노트 카드 목록 + 글 오버레이.
 * 카드를 누르면 페이지를 이동하지 않고 같은 React 트리 안에서 오버레이를 열어,
 * Motion의 layoutId로 카드 → 글 헤더를 실제 요소 그대로(spring) 이어 준다.
 * URL은 history.pushState로 /blog/<id>가 되고, 주소로 직접 들어오면 정적 글 페이지가 열린다.
 */
export default function NoteBrowser({ notes, search = false, siteTitle }: Props) {
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const [openId, setOpenId] = useState<string | null>(null);
  // 브라우저가 자체 스와이프 애니메이션을 이미 보여 준 경우엔 우리 애니메이션을 생략
  const [instant, setInstant] = useState(false);
  const openRef = useRef<string | null>(null);
  openRef.current = openId;
  const listTitle = useRef('');

  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<Filter>('all');
  const deferred = useDeferredValue(query);
  const visible = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    return notes.filter(
      (n) =>
        (stage === 'all' || n.stage === stage) &&
        (!q || [n.title, n.description, ...n.tags].some((s) => s.toLowerCase().includes(q))),
    );
  }, [notes, deferred, stage]);

  const open = useCallback(
    (id: string) => {
      const note = byId.get(id);
      if (!note) return;
      listTitle.current = document.title;
      history.pushState({ ...history.state, noteOverlay: id }, '', `/blog/${id}`);
      document.title = `${note.title} | ${siteTitle}`;
      setInstant(false);
      setOpenId(id);
    },
    [byId, siteTitle],
  );

  // 닫기는 항상 history.back() → popstate에서 처리 (버튼·Esc·드래그·브라우저 뒤로 가기 동일 경로)
  const close = useCallback(() => history.back(), []);

  useEffect(() => {
    // Astro ClientRouter도 popstate를 듣고 페이지를 다시 불러오므로, 오버레이와 관련된 이동은
    // BaseHead의 훅(window.__notePopState)을 통해 ClientRouter보다 먼저 처리하고 전파를 막는다.
    const onPop = (e: PopStateEvent & { hasUAVisualTransition?: boolean }) => {
      const id = history.state?.noteOverlay as string | undefined;
      if (id && byId.has(id)) {
        setInstant(!!e.hasUAVisualTransition);
        setOpenId(id);
        document.title = `${byId.get(id)!.title} | ${siteTitle}`;
        return true;
      }
      if (openRef.current) {
        setInstant(!!e.hasUAVisualTransition);
        setOpenId(null);
        if (listTitle.current) document.title = listTitle.current;
        return true;
      }
      return false;
    };
    window.__notePopState = onPop;
    return () => {
      if (window.__notePopState === onPop) window.__notePopState = undefined;
    };
  }, [byId, siteTitle]);

  // 카드가 화면에 보이면 브라우저가 한가할 때 글 내용을 미리 받아 둔다
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
    idle(() => notes.forEach((n) => prefetchNote(n.id)));
  }, [notes]);

  const openNote = openId ? byId.get(openId) : undefined;

  return (
    // LazyMotion + m 컴포넌트: 애니메이션 기능은 첫 화면 이후 별도 청크로 불러온다
    <LazyMotion features={loadFeatures} strict>
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        {search && (
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
        )}
        {visible.length === 0 ? (
          <p className="hand">아직 이런 씨앗은 심지 않았어요 🌱</p>
        ) : (
          <ul className="notes" data-no-preview>
            {visible.map((n) => (
              <NoteCard key={n.id} note={n} hidden={n.id === openId} instant={instant} onOpen={open} />
            ))}
          </ul>
        )}
        <AnimatePresence>
          {openNote && <NoteOverlay key={openNote.id} note={openNote} instant={instant} onClose={close} />}
        </AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
    </LazyMotion>
  );
}
