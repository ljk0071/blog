import type { MouseEvent } from 'react';
import { STAGES } from '../consts';
import type { NoteSummary } from '../lib';
import { prefetchNote } from './noteContent';

interface Props {
  note: NoteSummary;
  onOpen: (id: string) => void;
}

export default function NoteCard({ note, onOpen }: Props) {
  const stage = STAGES[note.stage];

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 새 탭 열기 등은 브라우저 기본 동작 그대로
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpen(note.id);
  };

  return (
    // data-note-card: 오버레이가 이 카드의 위치를 재고, 열려 있는 동안 숨긴다
    <li data-note-card={note.id}>
      <article className="note" onPointerEnter={() => prefetchNote(note.id)}>
        <span className="note-bg" aria-hidden="true" />
        <span className="stage" title={stage.hint}>
          {stage.emoji} {stage.label}
        </span>
        <a className="title" href={`/blog/${note.id}`} data-note-id={note.id} onClick={onClick}>
          {note.title}
        </a>
        <p className="desc">{note.description}</p>
        <div className="meta">
          <time dateTime={note.iso}>{note.date}</time>
          {note.tags.map((t) => (
            <a key={t} className="tag" href={`/tags/${encodeURIComponent(t)}`}>
              #{t}
            </a>
          ))}
        </div>
      </article>
    </li>
  );
}
