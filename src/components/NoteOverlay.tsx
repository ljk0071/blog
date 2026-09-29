import { useMotionValue, useTransform, type PanInfo } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STAGES } from '../consts';
import type { NoteSummary } from '../lib';
import { INSTANT, MORPH, fade } from './motionConfig';
import { prefetchNote, type NoteContent } from './noteContent';

interface Props {
  note: NoteSummary;
  instant: boolean;
  onClose: () => void;
}

// 이만큼 오른쪽으로 밀면(또는 빠르게 튕기면) 닫힌다
const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 600;

export default function NoteOverlay({ note, instant, onClose }: Props) {
  const stage = STAGES[note.stage];
  const morph = instant ? INSTANT : MORPH;
  const [content, setContent] = useState<NoteContent | null>(null);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 드래그 거리 → 글 페이지가 카드처럼 작아지며 뒤의 목록이 드러난다 (되감기)
  const x = useMotionValue(0);
  const progress = useTransform(x, [0, 320], [0, 1], { clamp: true });
  const scale = useTransform(progress, [0, 1], [1, 0.86]);
  const radius = useTransform(progress, [0, 1], [0, 24]);
  const backdrop = useTransform(progress, [0, 1], [1, 0.1]);
  const [origin, setOrigin] = useState('50% 0px');

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

  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = prevOverflow;
      removeEventListener('keydown', onKey);
      // 닫히면 원래 카드로 포커스 복귀
      document.querySelector<HTMLElement>(`a[data-note-id="${note.id}"]`)?.focus({ preventScroll: true });
    };
  }, [note.id, onClose]);

  const onDragStart = () => {
    const el = scrollRef.current;
    if (el) setOrigin(`50% ${el.scrollTop + el.clientHeight / 2}px`);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    // 덜 밀었으면 dragSnapToOrigin이 제자리로 되돌린다
    const flicked = info.velocity.x > CLOSE_VELOCITY && info.offset.x > 40;
    if (info.offset.x > CLOSE_DISTANCE || flicked) onClose();
  };

  const titleId = `overlay-title-${note.id}`;
  const f = (delay = 0) => fade(instant, delay);
  // 닫힐 때는 공유 요소(상자·단계·제목)만 카드로 돌아가고 나머지는 바로 사라진다
  const out = fade(instant, 0, 0.08);

  return createPortal(
    <div className="ov-root" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <m.div
        className="ov-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: out }}
        transition={f(0)}
      >
        <m.div className="ov-backdrop-fill" style={{ opacity: backdrop }} />
      </m.div>
      <div className="ov-scroll" ref={scrollRef}>
        <m.div
          className="ov-page"
          style={{ x, scale, borderRadius: radius, transformOrigin: origin }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 0.9 }}
          dragMomentum={false}
          dragSnapToOrigin
          dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <m.div
            className="ov-page-bg"
            style={{ borderRadius: radius }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: out }}
            transition={f(0)}
          />
          <div className="ov-inner">
            <m.div className="ov-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: out }} transition={f(0.15)}>
              <button ref={closeRef} type="button" onClick={onClose}>
                ← 목록으로
              </button>
              <span className="hand">오른쪽으로 밀어서 닫기</span>
            </m.div>

            <header className="post-header note-header">
              <m.span
                layoutId={`bg-${note.id}`}
                className="note-bg"
                style={{ borderRadius: 14 }}
                transition={morph}
                exit={{ opacity: 0, transition: INSTANT }}
              />
              <p className="stage-line">
                <m.span
                  layoutId={`stage-${note.id}`}
                  className="stage-pill"
                  title={stage.hint}
                  transition={morph}
                  exit={{ opacity: 0, transition: INSTANT }}
                >
                  {stage.emoji} {stage.label}
                </m.span>
                <m.span className="hand" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: out }} transition={f(0.2)}>
                  {stage.hint}
                </m.span>
              </p>
              <m.h1 id={titleId} layoutId={`title-${note.id}`} transition={morph} exit={{ opacity: 0, transition: INSTANT }}>
                {note.title}
              </m.h1>
              <m.p className="post-meta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: out }} transition={f(0.2)}>
                <span>
                  심은 날 <time dateTime={note.iso}>{note.date}</time>
                </span>
                <span>{note.minutes}분</span>
              </m.p>
              <m.p className="post-tags" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: out }} transition={f(0.2)}>
                {note.tags.map((t) => (
                  <a key={t} className="tag" href={`/tags/${encodeURIComponent(t)}`}>
                    #{t}
                  </a>
                ))}
              </m.p>
            </header>

            {failed ? (
              <p>
                본문을 불러오지 못했어요. <a href={`/blog/${note.id}`}>페이지로 열기</a>
              </p>
            ) : (
              <m.div
                className="prose"
                initial={{ opacity: 0, y: 16 }}
                animate={content ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                exit={{ opacity: 0, transition: out }}
                transition={fade(instant, 0.25, 0.35)}
                dangerouslySetInnerHTML={{ __html: content?.prose ?? '' }}
              />
            )}
            {content?.extra && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: out }}
                transition={fade(instant, 0.35)}
                dangerouslySetInnerHTML={{ __html: content.extra }}
              />
            )}
          </div>
        </m.div>
      </div>
    </div>,
    document.body,
  );
}
