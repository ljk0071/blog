import type { Transition } from 'motion/react';

/** 카드 ↔ 글 헤더 공유 요소 이동: 살짝 탄성 있는 spring */
export const MORPH: Transition = { type: 'spring', duration: 0.55, bounce: 0.14 };
/** 브라우저가 자체 스와이프 애니메이션을 이미 보여 줬을 때 */
export const INSTANT: Transition = { duration: 0 };

export const fade = (instant: boolean, delay = 0, duration = 0.22): Transition =>
  instant ? INSTANT : { duration, delay, ease: 'easeOut' };
