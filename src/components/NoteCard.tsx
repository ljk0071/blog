import * as m from 'motion/react-m';
import type { MouseEvent } from 'react';
import { STAGES } from '../consts';
import type { NoteSummary } from '../lib';
import { INSTANT, MORPH, fade } from './motionConfig';
import { prefetchNote } from './noteContent';

interface Props {
  note: NoteSummary;
  /** 이 카드의 글이 오버레이로 열려 있음 → 공유 요소를 오버레이에 넘겨준다 */
  hidden: boolean;
  instant: boolean;
  onOpen: (id: string) => void;
}

export default function NoteCard({ note, hidden, instant, onOpen }: Props) {
  const stage = STAGES[note.stage];
  const morph = instant ? INSTANT : MORPH;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 새 탭 열기 등은 브라우저 기본 동작 그대로
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(note.id);
  };

  return (
    <li>
      <article className="note" onPointerEnter={() => prefetchNote(note.id)}>
        {/* 열려 있는 동안엔 layoutId를 빼서 오버레이 쪽 요소가 주인공이 되게 한다 */}
        {hidden ? (
          <span className="note-bg" style={{ visibility: 'hidden' }} />
        ) : (
          <m.span layoutId={`bg-${note.id}`} className="note-bg" style={{ borderRadius: 14 }} transition={morph} />
        )}
        {hidden ? (
          <span className="stage" style={{ visibility: 'hidden' }}>
            {stage.emoji} {stage.label}
          </span>
        ) : (
          <m.span layoutId={`stage-${note.id}`} className="stage" title={stage.hint} transition={morph}>
            {stage.emoji} {stage.label}
          </m.span>
        )}
        <m.a
          layoutId={hidden ? undefined : `title-${note.id}`}
          className="title"
          href={`/blog/${note.id}`}
          data-note-id={note.id}
          onClick={onClick}
          style={{ visibility: hidden ? 'hidden' : 'visible' }}
          transition={morph}
        >
          {note.title}
        </m.a>
        <m.p className="desc" animate={{ opacity: hidden ? 0 : 1 }} transition={fade(instant, hidden ? 0 : 0.3)}>
          {note.description}
        </m.p>
        <m.div className="meta" animate={{ opacity: hidden ? 0 : 1 }} transition={fade(instant, hidden ? 0 : 0.3)}>
          <time dateTime={note.iso}>{note.date}</time>
          {note.tags.map((t) => (
            <a key={t} className="tag" href={`/tags/${encodeURIComponent(t)}`}>
              #{t}
            </a>
          ))}
        </m.div>
      </article>
    </li>
  );
}
