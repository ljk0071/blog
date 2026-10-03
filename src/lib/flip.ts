/**
 * 컴포지터(GPU)에서 도는 애니메이션을 위한 도우미.
 * iOS Safari 는 requestAnimationFrame(JS 애니메이션)을 기본 60Hz 로 제한하지만,
 * Web Animations API 로 transform·opacity 만 움직이면 ProMotion 120Hz 로 그려진다.
 * spring 느낌은 물리 시뮬레이션 결과를 CSS linear() 이징 곡선으로 구워서 낸다.
 */

export interface Spring {
  easing: string;
  duration: number;
}

interface SpringParams {
  stiffness: number;
  damping: number;
  mass?: number;
}

const supportsLinear = typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", "linear(0, 1)");

export function spring({ stiffness, damping, mass = 1 }: SpringParams): Spring {
  // 0 → 1 로 가는 감쇠 진동을 1/240초 간격으로 적분해, 멈출 때까지의 궤적을 구한다
  const dt = 1 / 240;
  const xs: number[] = [0];
  let x = 0;
  let v = 0;
  for (let t = 0; t < 3; t += dt) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    xs.push(x);
    if (Math.abs(x - 1) < 0.0005 && Math.abs(v) < 0.01) break;
  }
  const duration = Math.round((xs.length - 1) * dt * 1000);
  if (!supportsLinear) return { duration, easing: "cubic-bezier(0.2, 0.9, 0.25, 1)" };
  const n = 64;
  const pts = Array.from({ length: n + 1 }, (_, i) => +xs[Math.round((i / n) * (xs.length - 1))].toFixed(4));
  pts[n] = 1;
  return { duration, easing: `linear(${pts.join(", ")})` };
}

/** 열기: 살짝 여유 있게, 끝에서 아주 미세하게 넘쳤다 돌아옴 */
export const OPEN = spring({ stiffness: 210, damping: 25 });
/** 닫기: 더 빠르고 단단하게 */
export const CLOSE = spring({ stiffness: 320, damping: 33 });
/** 드래그를 덜 해서 제자리로 돌아갈 때 */
export const SNAP = spring({ stiffness: 400, damping: 32 });

export const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 진행 중인 애니메이션인지 */
export const isRunning = (a?: Animation) => !!a && (a.playState === "running" || a.pending);
