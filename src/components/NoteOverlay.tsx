import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { STAGES } from '../consts';
import type { NoteSummary } from '../lib';
import { CLOSE, OPEN, SNAP, isRunning, prefersReducedMotion } from './flip';
import { peekNote, prefetchNote, type NoteContent } from './noteContent';

export type Phase = 'open' | 'closing';

interface Props {
  note: NoteSummary;
  phase: Phase;
  /** 브라우저가 자체 스와이프 애니메이션을 이미 보여 줬으면 애니메이션 없이 닫는다 */
  instant: boolean;
  /** 닫기 요청 (history.back → popstate → phase='closing') */
  onRequestClose: () => void;
  /** 닫힘 애니메이션이 끝남 → 언마운트 */
  onExited: () => void;
}

// 이만큼 오른쪽으로 밀면(또는 빠르게 튕기면) 닫힌다
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 600; // px/s
const DRAG_RANGE = 360; // 이 거리에서 최대로 작아짐
const DRAG_MIN_SCALE = 0.86;

/**
 * 글 오버레이.
 * 글 페이지 전체(헤더 + 본문)를 하나의 레이어로 두고, 헤더 카드가 목록 카드와 겹치도록
 * 축소·이동한 상태에서 원래 자리로 되돌리는 FLIP 애니메이션을 Web Animations API로 실행한다.
 * transform·opacity만 움직여 컴포지터에서 120Hz로 그려지고, 본문이 처음부터 헤더에 붙어 함께 커진다.
 */
export default function NoteOverlay({ note, phase, instant, onRequestClose, onExited }: Props) {
  const stage = STAGES[note.stage];
  const [content, setContent] = useState<NoteContent | null>(() => peekNote(note.id) ?? null);
  const [failed, setFailed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const anims = useRef<Animation[]>([]);
  const header = useRef({ x: 0, y: 0, w: 1 }); // 패널 기준 헤더 위치(변환 전)
  const exited = useRef(false);

  const cardEl = () => document.querySelector<HTMLElement>(`[data-note-card="${CSS.escape(note.id)}"]`);
  const chrome = () => panelRef.current?.querySelectorAll<HTMLElement>('[data-ov-chrome]') ?? [];
  const body = () => panelRef.current?.querySelectorAll<HTMLElement>('[data-ov-body]') ?? [];
  const covers = () => [backdropRef.current!, ...(panelRef.current?.querySelectorAll<HTMLElement>('[data-ov-sheet]') ?? [])];

  /** 변환이 없을 때 패널의 화면상 왼쪽 위 좌표 */
  const panelOrigin = () => {
    const s = scrollRef.current!;
    const r = s.getBoundingClientRect();
    return { left: r.left + panelRef.current!.offsetLeft, top: r.top + panelRef.current!.offsetTop - s.scrollTop };
  };

  /** 헤더 카드를 목록 카드 위치·너비에 맞추는 transform (transform-origin: 0 0 기준) */
  const toCard = () => {
    const card = cardEl();
    if (!card) return null;
    const c = card.getBoundingClientRect();
    const p = panelOrigin();
    const { x, y, w } = header.current;
    const s = c.width / w;
    return `translate(${c.left - p.left - x * s}px, ${c.top - p.top - y * s}px) scale(${s})`;
  };

  const track = (a: Animation) => {
    anims.current.push(a);
    return a;
  };
  const finishExit = () => {
    if (exited.current) return;
    exited.current = true;
    cardEl()?.getAnimations().forEach((a) => a.cancel());
    onExited();
  };

  // 본문은 미리 받아 둔 정적 페이지에서
  useEffect(() => {
    let alive = true;
    prefetchNote(note.id).then(
      (c) => alive && setContent(c),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [note.id]);

  // 스크롤 잠금·포커스·Esc
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onRequestClose();
    addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = prev;
      removeEventListener('keydown', onKey);
      document.querySelector<HTMLElement>(`a[data-note-id="${CSS.escape(note.id)}"]`)?.focus({ preventScroll: true });
    };
  }, [note.id, onRequestClose]);

  // 열기: 페인트 전에 측정하고 첫 프레임부터 애니메이션
  useLayoutEffect(() => {
    const panel = panelRef.current!;
    const h = headerRef.current!.getBoundingClientRect();
    const p = panelOrigin();
    header.current = { x: h.left - p.left, y: h.top - p.top, w: h.width };

    const card = cardEl();
    const from = toCard();
    if (instant || prefersReducedMotion() || !card || !from) {
      card?.animate([{ opacity: 0 }], { duration: 0, fill: 'forwards' });
      return;
    }
    panel.style.willChange = 'transform, opacity';
    // 목록 카드는 빠르게 사라지고, 같은 자리에서 글 페이지가 나타나 커진다
    track(card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'linear', fill: 'forwards' }));
    const grow = track(panel.animate([{ transform: from }, { transform: 'none' }], { duration: OPEN.duration, easing: OPEN.easing }));
    track(panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear', fill: 'backwards' }));
    // 배경·종이가 먼저 목록을 덮고, 본문 글자는 그 직후에 나타나 목록 글자와 겹쳐 보이지 않게 한다
    covers().forEach((el) =>
      track(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 170, easing: 'ease-out', fill: 'backwards' })),
    );
    chrome().forEach((el) =>
      track(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 200, easing: 'ease-out', fill: 'backwards' })),
    );
    body().forEach((el) =>
      track(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 90, easing: 'ease-out', fill: 'backwards' })),
    );
    grow.finished.then(() => (panel.style.willChange = ''), () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 닫기 (또는 닫는 도중 다시 열기) — phase가 실제로 바뀔 때만
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current === phase) return;
    prevPhase.current = phase;
    const running = anims.current.filter(isRunning);
    if (phase === 'open') {
      // 닫히던 중에 앞으로 가기 → 그 자리에서 다시 펼친다
      if (running.length) running.forEach((a) => a.reverse());
      return;
    }
    if (instant || prefersReducedMotion()) return finishExit();

    // 열리던 중이면 진행 중인 애니메이션을 그 자리에서 거꾸로 재생 (되감기)
    if (running.length) {
      running.forEach((a) => a.reverse());
      Promise.all(running.map((a) => a.finished)).then(finishExit, () => {});
      return;
    }

    const panel = panelRef.current!;
    const to = toCard();
    if (!to) return finishExit();
    const current = getComputedStyle(panel).transform; // 드래그 중이던 위치에서 이어서
    const backdropNow = getComputedStyle(backdropRef.current!).opacity;
    anims.current = [];
    panel.style.willChange = 'transform, opacity';
    const shrink = track(
      panel.animate([{ transform: current === 'none' ? 'none' : current }, { transform: to }], {
        duration: CLOSE.duration,
        easing: CLOSE.easing,
        fill: 'forwards',
      }),
    );
    // 카드 크기에 거의 도착할 즈음 글 페이지는 사라지고 목록 카드가 드러난다
    track(
      panel.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], {
        duration: CLOSE.duration * 0.8,
        easing: 'linear',
        fill: 'forwards',
      }),
    );
    track(backdropRef.current!.animate([{ opacity: backdropNow }, { opacity: 0 }], { duration: CLOSE.duration * 0.7, easing: 'ease-out', fill: 'forwards' }));
    [...chrome(), ...body(), ...covers().slice(1)].forEach((el) =>
      track(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-out', fill: 'forwards' })),
    );
    const card = cardEl();
    if (card) {
      card.getAnimations().forEach((a) => a.cancel());
      track(card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: CLOSE.duration * 0.45, easing: 'linear', fill: 'both' }));
    }
    shrink.finished.then(finishExit, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------- 끌어서 닫기 (되감기) ----------
  const drag = useRef<{ id: number; x0: number; y0: number; on: boolean; cx: number; cy: number; dx: number; samples: [number, number][] } | null>(
    null,
  );
  const suppressClick = useRef(false);

  const applyDrag = (dx: number) => {
    const d = drag.current!;
    const p = Math.min(1, Math.max(0, dx / DRAG_RANGE));
    const k = 1 - (1 - DRAG_MIN_SCALE) * p;
    // 화면 중앙을 기준으로 작아지며 손가락을 따라 이동 (transform-origin 0 0 기준으로 환산)
    panelRef.current!.style.transform = `translate(${dx + d.cx * (1 - k)}px, ${d.cy * (1 - k)}px) scale(${k})`;
    backdropRef.current!.style.opacity = String(1 - 0.85 * p);
  };

  const onPointerDown = (e: RPointerEvent) => {
    if (phase !== 'open' || e.button !== 0 || anims.current.some(isRunning)) return;
    const s = scrollRef.current!;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, cx: s.clientWidth / 2, cy: s.scrollTop + s.clientHeight / 2, dx: 0, samples: [] };
  };
  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (drag.current = null); // 세로 스크롤
      if (dx < 10 || dx < Math.abs(dy) * 1.2) return;
      d.on = true;
      panelRef.current!.setPointerCapture(e.pointerId);
      panelRef.current!.style.willChange = 'transform';
      panelRef.current!.classList.add('dragging');
    }
    d.dx = Math.max(0, dx);
    d.samples.push([e.timeStamp, d.dx]);
    if (d.samples.length > 5) d.samples.shift();
    applyDrag(d.dx);
  };
  const onPointerUp = (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.on || d.id !== e.pointerId) return;
    panelRef.current!.classList.remove('dragging');
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 0);
    const [t0, x0] = d.samples[0] ?? [e.timeStamp, d.dx];
    const v = ((d.dx - x0) / Math.max(1, e.timeStamp - t0)) * 1000;
    if (d.dx > CLOSE_DISTANCE || (v > CLOSE_VELOCITY && d.dx > 40)) {
      onRequestClose();
      return;
    }
    // 덜 밀었으면 제자리로
    const panel = panelRef.current!;
    const from = panel.style.transform;
    const op = backdropRef.current!.style.opacity;
    panel.style.transform = '';
    backdropRef.current!.style.opacity = '';
    panel.animate([{ transform: from }, { transform: 'none' }], { duration: SNAP.duration, easing: SNAP.easing });
    backdropRef.current!.animate([{ opacity: op }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  };

  const titleId = `overlay-title-${note.id}`;

  return createPortal(
    <div className="ov-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ov-backdrop" ref={backdropRef} />
      <div className="ov-scroll" ref={scrollRef}>
        <div
          className="ov-page"
          ref={panelRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClickCapture={(e) => suppressClick.current && (e.preventDefault(), e.stopPropagation())}
        >
          <div className="ov-inner">
            {/* 글 페이지 종이: 열릴 때 배경과 함께 나타나고, 끌 때 카드처럼 보이게 한다 */}
            <div className="ov-sheet" data-ov-sheet aria-hidden="true" />
            <div className="ov-bar" data-ov-chrome>
              <button ref={closeRef} type="button" onClick={onRequestClose}>
                ← 목록으로
              </button>
              <span className="hand">오른쪽으로 밀어서 닫기</span>
            </div>

            <header className="post-header note-header" ref={headerRef}>
              <span className="note-bg" aria-hidden="true" />
              <p className="stage-line">
                <span className="stage-pill" title={stage.hint}>
                  {stage.emoji} {stage.label}
                </span>
                <span className="hand" data-ov-chrome>
                  {stage.hint}
                </span>
              </p>
              <h1 id={titleId}>{note.title}</h1>
              <p className="post-meta">
                <span>
                  심은 날 <time dateTime={note.iso}>{note.date}</time>
                </span>
                <span>{note.minutes}분</span>
              </p>
              <p className="post-tags">
                {note.tags.map((t) => (
                  <a key={t} className="tag" href={`/tags/${encodeURIComponent(t)}`}>
                    #{t}
                  </a>
                ))}
              </p>
            </header>

            {failed ? (
              <p data-ov-body>
                본문을 불러오지 못했어요. <a href={`/blog/${note.id}`}>페이지로 열기</a>
              </p>
            ) : (
              <div className="prose" data-ov-body dangerouslySetInnerHTML={{ __html: content?.prose ?? '' }} />
            )}
            {content?.extra && <div data-ov-body dangerouslySetInnerHTML={{ __html: content.extra }} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
