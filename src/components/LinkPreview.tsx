import { useEffect, useMemo, useState } from 'react';
import { STAGES } from '../consts';
import type { PreviewItem } from '../lib';

type State = { item: PreviewItem; x: number; y: number; below: boolean } | null;

const CARD_W = 320;

/**
 * 본문 속 다른 노트로 가는 링크(/blog/...)에 마우스를 올리거나 포커스하면 미리보기 카드를 띄운다.
 * 링크마다 컴포넌트를 두지 않고 document 이벤트 위임 하나로 처리한다.
 * data-no-preview 영역(카드 목록·그래프처럼 이미 요약이 보이는 곳)과 터치 입력은 제외.
 */
export default function LinkPreview({ items }: { items: PreviewItem[] }) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLAnchorElement | null = null;

    const anchorOf = (t: EventTarget | null) =>
      t instanceof Element ? t.closest<HTMLAnchorElement>('a[href^="/blog/"]') : null;

    const show = (a: HTMLAnchorElement) => {
      if (a.closest('[data-no-preview]')) return;
      const id = new URL(a.href).pathname.replace(/^\/blog\//, '').replace(/\/$/, '');
      const item = byId.get(id);
      if (!item || location.pathname === `/blog/${id}`) return;
      const r = a.getBoundingClientRect();
      const half = Math.min(CARD_W, innerWidth - 32) / 2;
      const below = r.top < 200;
      setState({
        item,
        x: Math.min(innerWidth - 16 - half, Math.max(16 + half, r.left + r.width / 2)),
        y: below ? r.bottom + 10 : r.top - 10,
        below,
      });
    };
    const hide = () => {
      clearTimeout(timer);
      current = null;
      setState(null);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const a = anchorOf(e.target);
      if (!a || a === current) return;
      current = a;
      clearTimeout(timer);
      timer = setTimeout(() => show(a), 250);
    };
    const onOut = (e: PointerEvent) => {
      const a = anchorOf(e.target);
      if (a && !a.contains(e.relatedTarget as Node | null)) hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const a = anchorOf(e.target);
      if (a) show(a);
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', hide);
    addEventListener('scroll', hide, { passive: true });
    // ClientRouter로 페이지를 옮기기 시작하면 떠 있는 카드를 닫는다
    document.addEventListener('astro:before-preparation', hide);
    return () => {
      document.removeEventListener('astro:before-preparation', hide);
      clearTimeout(timer);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', hide);
      removeEventListener('scroll', hide);
    };
  }, [byId]);

  if (!state) return null;
  const { item, x, y, below } = state;
  const stage = STAGES[item.stage];
  return (
    <div
      role="tooltip"
      className="link-preview card"
      style={{ left: x, top: y, transform: `translate(-50%, ${below ? '0' : '-100%'})` }}
    >
      <span className="stage">
        {stage.emoji} {stage.label} · {item.date}
      </span>
      <strong>{item.title}</strong>
      <p>{item.description}</p>
      <style>{`
        .link-preview { position: fixed; z-index: 50; width: min(${CARD_W}px, calc(100vw - 32px)); padding: 0.9rem 1.1rem; pointer-events: none; display: flex; flex-direction: column; gap: 0.25rem; animation: lp-in .15s ease-out; }
        .link-preview strong { font-family: var(--serif); font-size: 1.02rem; line-height: 1.45; }
        .link-preview p { margin: 0; font-size: 0.86rem; line-height: 1.6; color: var(--muted); }
        @keyframes lp-in { from { opacity: 0; } }
      `}</style>
    </div>
  );
}
