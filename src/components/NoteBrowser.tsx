import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, type Stage } from '../consts';
import type { NoteSummary } from '../lib';
import NoteCard from './NoteCard';
import NoteOverlay, { type Phase } from './NoteOverlay';
import { prefetchNote } from './noteContent';

declare global {
  interface Window {
    /** BaseHead의 popstate 훅이 호출. true를 반환하면 ClientRouter로 전파하지 않는다 */
    __notePopState?: (e: PopStateEvent) => boolean;
  }
}

type Filter = Stage | 'all';
const FILTERS: Filter[] = ['all', 'seedling', 'budding', 'evergreen'];
// 본문이 아직 없으면 이만큼만 기다렸다가 연다 (보통은 미리 받아 둬서 즉시)
const CONTENT_WAIT_MS = 250;

interface Props {
  notes: NoteSummary[];
  /** 검색창·성장 단계 필터 표시 (/blog) */
  search?: boolean;
  siteTitle: string;
}

/**
 * 노트 카드 목록 + 글 오버레이.
 * 카드를 누르면 페이지를 이동하지 않고 오버레이로 글을 연다(NoteOverlay가 FLIP 애니메이션 담당).
 * URL은 history.pushState로 /blog/<id>가 되고, 주소로 직접 들어오면 정적 글 페이지가 열린다.
 */
export default function NoteBrowser({ notes, search = false, siteTitle }: Props) {
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('open');
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

  const show = useCallback(
    (id: string, isInstant: boolean) => {
      document.title = `${byId.get(id)!.title} | ${siteTitle}`;
      setInstant(isInstant);
      setPhase('open');
      setOpenId(id);
    },
    [byId, siteTitle],
  );

  const open = useCallback(
    async (id: string) => {
      if (!byId.has(id) || openRef.current) return;
      // 첫 프레임부터 본문까지 그려지도록, 받아 둔 본문이 없으면 잠깐 기다린다
      await Promise.race([prefetchNote(id).catch(() => {}), new Promise((r) => setTimeout(r, CONTENT_WAIT_MS))]);
      listTitle.current = document.title;
      history.pushState({ ...history.state, noteOverlay: id }, '', `/blog/${id}`);
      show(id, false);
    },
    [byId, show],
  );

  // 닫기는 항상 history.back() → popstate에서 처리 (버튼·Esc·드래그·브라우저 뒤로 가기 동일 경로)
  const requestClose = useCallback(() => history.back(), []);
  const onExited = useCallback(() => setOpenId(null), []);

  useEffect(() => {
    // Astro ClientRouter도 popstate를 듣고 페이지를 다시 불러오므로, 오버레이와 관련된 이동은
    // BaseHead의 훅(window.__notePopState)을 통해 ClientRouter보다 먼저 처리하고 전파를 막는다.
    const onPop = (e: PopStateEvent & { hasUAVisualTransition?: boolean }) => {
      const id = history.state?.noteOverlay as string | undefined;
      const ua = !!e.hasUAVisualTransition;
      if (id && byId.has(id)) {
        show(id, ua);
        return true;
      }
      if (openRef.current) {
        setInstant(ua);
        setPhase('closing');
        if (listTitle.current) document.title = listTitle.current;
        return true;
      }
      return false;
    };
    window.__notePopState = onPop;
    return () => {
      if (window.__notePopState === onPop) window.__notePopState = undefined;
    };
  }, [byId, show]);

  // 브라우저가 한가할 때 목록의 글 본문을 미리 받아 둔다
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
    idle(() => notes.forEach((n) => prefetchNote(n.id).catch(() => {})));
  }, [notes]);

  const openNote = openId ? byId.get(openId) : undefined;

  return (
    <>
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
            <NoteCard key={n.id} note={n} onOpen={open} />
          ))}
        </ul>
      )}
      {openNote && (
        <NoteOverlay
          key={openNote.id}
          note={openNote}
          phase={phase}
          instant={instant}
          onRequestClose={requestClose}
          onExited={onExited}
        />
      )}
    </>
  );
}
