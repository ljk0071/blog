/**
 * 노트 카드 ↔ 글 페이지 전환 (브라우저 전용).
 *
 * 글은 일반 라우트(/blog/:id)다. 카드를 누르면 라우터가 새 페이지로 이동하고, 이 모듈이 그 위에
 * "카드가 글로 펼쳐지는" 전환을 입힌다. 목록 화면이 사라져도 전환 중에 보이도록, 클릭 순간
 * 앱 DOM 을 복제해 고정 레이어(backdrop)로 깔아 둔다.
 *
 *   열기  : 클릭(복제본 생성) → 라우트 교체 → 글 패널이 카드 위치에서 FLIP 으로 원래 자리까지 커진다.
 *   닫기  : 뒤로 가기를 가로채(useBeforeLeave) 패널이 카드 자리로 줄어든 뒤 실제 이동을 이어 간다.
 *   끌기  : 오른쪽으로 끌면 손가락을 따라 작아지고(되감기), 놓으면 닫히거나 제자리로 돌아온다.
 *
 * 전부 Web Animations API 로 transform·opacity 만 움직여 컴포지터(120Hz)에서 그려진다.
 */
import { CLOSE, OPEN, SNAP, isRunning, prefersReducedMotion } from "./flip";

interface Origin {
  id: string;
  rect: DOMRect;
  scrollY: number;
  at: number;
  backdrop: HTMLElement;
  cover: HTMLElement;
}

let origin: Origin | undefined;
let uaPopAt = -Infinity;
let safetyTimer: ReturnType<typeof setTimeout> | undefined;

if (typeof window !== "undefined") {
  // iOS 가장자리 스와이프처럼 브라우저가 자체 전환 애니메이션을 이미 보여 준 경우엔 우리 애니메이션은 생략한다.
  addEventListener(
    "popstate",
    (e) => {
      if ((e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition) uaPopAt = performance.now();
    },
    true
  );
}

const ORIGIN_TTL = 5000;
const appRoot = () => document.querySelector<HTMLElement>(".app-root:not(.clone)");

/** 카드를 누른 순간: 카드 위치와 화면 복제본을 저장한다. 라우터의 클릭 처리보다 먼저(capture) 호출돼야 한다. */
export function captureOrigin(id: string, card: HTMLElement) {
  dropOrigin();
  const app = appRoot();
  if (!app || prefersReducedMotion()) return;

  const scrollY = window.scrollY;
  const backdrop = document.createElement("div");
  backdrop.className = "reader-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.inert = true;

  const clone = app.cloneNode(true) as HTMLElement;
  clone.classList.add("clone");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  clone.style.transform = `translateY(${-scrollY}px)`;

  const cover = document.createElement("div");
  cover.className = "cover";
  cover.style.opacity = "0";

  backdrop.append(clone, cover);
  document.body.append(backdrop);
  origin = { id, rect: card.getBoundingClientRect(), scrollY, at: performance.now(), backdrop, cover };

  // 라우팅이 실패/취소돼 글 페이지가 이 복제본을 가져가지 않으면 정리한다.
  clearTimeout(safetyTimer);
  safetyTimer = setTimeout(() => {
    if (origin && performance.now() - origin.at >= ORIGIN_TTL - 100) dropOrigin();
  }, ORIGIN_TTL);
}

export function dropOrigin() {
  clearTimeout(safetyTimer);
  origin?.backdrop.remove();
  origin = undefined;
}

/** 이 글을 카드에서 열었는가 (닫기·끌기 애니메이션 가능 여부) */
export const hasOrigin = (id: string) => !!origin && origin.id === id && performance.now() - origin.at < 30 * 60 * 1000;

const originFor = (id: string) => (origin && origin.id === id ? origin : undefined);

// ---------- 기하 계산 ----------

interface Geometry {
  /** 패널의 변환 전 화면 좌표 */
  px: number;
  py: number;
  /** 패널 안에서 헤더 위치와 너비 */
  hx: number;
  hy: number;
  hw: number;
}

function measure(panel: HTMLElement, header: HTMLElement): Geometry {
  const p = panel.getBoundingClientRect();
  const h = header.getBoundingClientRect();
  return { px: p.left, py: p.top, hx: h.left - p.left, hy: h.top - p.top, hw: h.width };
}

/** 헤더가 카드 위치·너비에 맞도록 패널을 옮기는 transform (transform-origin: 0 0) */
function toCard(g: Geometry, card: DOMRect) {
  const s = card.width / g.hw;
  return `translate(${card.left - g.px - g.hx * s}px, ${card.top - g.py - g.hy * s}px) scale(${s})`;
}

const finishedOf = (a: Animation) => a.finished.then(() => undefined, () => undefined);

// ---------- 열기 ----------

export interface ReaderParts {
  panel: HTMLElement;
  header: HTMLElement;
}

/** 글 페이지가 마운트된 직후 호출. 카드에서 열렸다면 FLIP 으로 펼친다. */
export function playEnter(id: string, { panel, header }: ReaderParts) {
  const o = originFor(id);
  if (!o) return;
  if (performance.now() - o.at > ORIGIN_TTL || prefersReducedMotion()) return dropOrigin();

  const g = measure(panel, header);
  const from = toCard(g, o.rect);
  const chrome = panel.querySelectorAll<HTMLElement>("[data-fade='chrome']");
  const body = panel.querySelectorAll<HTMLElement>("[data-fade='body']");

  panel.classList.add("lifting");
  panel.style.willChange = "transform, opacity";
  const grow = panel.animate([{ transform: from }, { transform: "none" }], { duration: OPEN.duration, easing: OPEN.easing });
  panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, easing: "linear", fill: "backwards" });
  // 목록은 배경색으로 빠르게 덮이고, 카드가 거의 펼쳐진 뒤 복제본 레이어 전체가 걷힌다(헤더·푸터가 드러남)
  o.cover.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 170, easing: "ease-out", fill: "forwards" });
  const lift = o.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 240,
    delay: Math.round(OPEN.duration * 0.55),
    easing: "ease-out",
    fill: "forwards"
  });
  chrome.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 200, easing: "ease-out", fill: "backwards" }));
  body.forEach((el) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 90, easing: "ease-out", fill: "backwards" }));

  void Promise.all([finishedOf(grow), finishedOf(lift)]).then(() => {
    panel.style.willChange = "";
    panel.classList.remove("lifting");
    if (origin === o) dropOrigin();
    else o.backdrop.remove();
  });
}

// ---------- 닫기 ----------

/** 뒤로 가기 이동을 가로채 애니메이션을 보여 줄 수 있는가 */
export function canAnimateExit(id: string, to: unknown) {
  if (!originFor(id) || prefersReducedMotion()) return false;
  if (performance.now() - uaPopAt < 150) return false; // 브라우저가 이미 자체 전환을 보여 줌
  return typeof to === "number" && to < 0;
}

/**
 * 패널을 카드 자리로 줄인다. 끝나면 resolve → 호출자가 실제 라우팅을 이어 간다.
 * drag 중이었다면 현재 transform 에서 이어서 줄어든다.
 */
export async function playExit(id: string, parts: ReaderParts, geometry?: Geometry): Promise<void> {
  const o = originFor(id);
  if (!o) return;
  const { panel, header } = parts;
  const g = geometry ?? measure(panel, header);
  const to = toCard(g, o.rect);
  const current = getComputedStyle(panel).transform;
  const dragging = panel.classList.contains("dragging");

  if (!o.backdrop.isConnected) document.body.append(o.backdrop);
  panel.classList.add("lifting");
  panel.style.willChange = "transform, opacity";

  const chrome = panel.querySelectorAll<HTMLElement>("[data-fade='chrome'], [data-fade='body']");
  // 드래그 중에 인라인으로 준 값은 애니메이션이 이어받는다
  const startCover = parseFloat(o.cover.style.opacity || "1");
  const startBackdrop = parseFloat(o.backdrop.style.opacity || "0");
  panel.style.transform = "";
  o.cover.style.opacity = "";
  o.backdrop.style.opacity = "";

  const shrink = panel.animate([{ transform: dragging && current !== "none" ? current : "none" }, { transform: to }], {
    duration: CLOSE.duration,
    easing: CLOSE.easing,
    fill: "forwards"
  });
  panel.animate([{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], {
    duration: CLOSE.duration * 0.8,
    easing: "linear",
    fill: "forwards"
  });
  o.backdrop.animate([{ opacity: dragging ? startBackdrop : 0 }, { opacity: 1 }], { duration: 100, easing: "ease-out", fill: "forwards" });
  // 배경색이 걷히며 목록이 드러난다
  o.cover.animate([{ opacity: dragging ? startCover : 1 }, { opacity: 0 }], {
    duration: CLOSE.duration * 0.55,
    delay: dragging ? 0 : 60,
    easing: "ease-out",
    fill: "forwards"
  });
  chrome.forEach((el) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: "ease-out", fill: "forwards" }));

  await finishedOf(shrink);
}

/** 실제 라우팅이 끝나 목록이 마운트된 뒤: 복제본 레이어를 걷어 낸다. */
export function releaseAfterExit() {
  const o = origin;
  if (!o) return;
  // 라우터의 스크롤 복원이 끝날 시간을 한 프레임 준 뒤 서서히 걷는다
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (origin !== o) return;
      const fade = o.backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" });
      void finishedOf(fade).then(() => {
        if (origin === o) dropOrigin();
      });
    })
  );
}

// ---------- 끌어서 닫기 (되감기) ----------

const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 600; // px/s
const DRAG_RANGE = 360;
const DRAG_MIN_SCALE = 0.86;

interface SwipeOptions extends ReaderParts {
  id: string;
  /** 충분히 끌어서 놓았을 때: 닫기를 요청한다 (history.back → useBeforeLeave 가 playExit 으로 이어 줌) */
  onDismiss: (geometry: Geometry) => void;
}

/** panel 에 오른쪽으로 끌어 닫기 제스처를 붙인다. 반환값은 정리 함수. */
export function bindSwipeBack({ id, panel, header, onDismiss }: SwipeOptions): () => void {
  let state:
    | { pointer: number; x0: number; y0: number; on: boolean; cx: number; cy: number; dx: number; geometry: Geometry; samples: [number, number][] }
    | undefined;
  let suppressClick = false;

  const apply = (dx: number) => {
    const o = originFor(id);
    if (!state || !o) return;
    const p = Math.min(1, Math.max(0, dx / DRAG_RANGE));
    const k = 1 - (1 - DRAG_MIN_SCALE) * p;
    panel.style.transform = `translate(${dx + state.cx * (1 - k)}px, ${state.cy * (1 - k)}px) scale(${k})`;
    // 목록 레이어는 끌기 시작과 함께 나타나고, 끌수록 배경색이 걷혀 목록이 드러난다
    o.backdrop.style.opacity = String(Math.min(1, dx / 48));
    o.cover.style.opacity = String(1 - 0.85 * p);
  };

  const down = (e: PointerEvent) => {
    const o = originFor(id);
    if (!o || e.button !== 0 || panel.getAnimations().some(isRunning)) return;
    if ((e.target as Element).closest("pre, table, input, textarea, [data-no-swipe]")) return;
    const g = measure(panel, header);
    state = {
      pointer: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      on: false,
      cx: innerWidth / 2 - g.px,
      cy: innerHeight / 2 - g.py,
      dx: 0,
      geometry: g,
      samples: []
    };
  };

  const move = (e: PointerEvent) => {
    const s = state;
    if (!s || s.pointer !== e.pointerId) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return void (state = undefined); // 세로 스크롤
      if (dx < 10 || dx < Math.abs(dy) * 1.2) return;
      s.on = true;
      panel.setPointerCapture(e.pointerId);
      panel.style.willChange = "transform";
      panel.classList.add("lifting", "dragging");
      const o = originFor(id);
      if (o && !o.backdrop.isConnected) document.body.append(o.backdrop);
    }
    s.dx = Math.max(0, dx);
    s.samples.push([e.timeStamp, s.dx]);
    if (s.samples.length > 5) s.samples.shift();
    apply(s.dx);
  };

  const up = (e: PointerEvent) => {
    const s = state;
    state = undefined;
    if (!s || !s.on || s.pointer !== e.pointerId) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    const [t0, x0] = s.samples[0] ?? [e.timeStamp, s.dx];
    const v = ((s.dx - x0) / Math.max(1, e.timeStamp - t0)) * 1000;
    if (s.dx > CLOSE_DISTANCE || (v > CLOSE_VELOCITY && s.dx > 40)) {
      onDismiss(s.geometry);
      return;
    }
    // 덜 밀었으면 제자리로
    const o = originFor(id);
    const from = panel.style.transform;
    const coverNow = o?.cover.style.opacity;
    const backdropNow = o?.backdrop.style.opacity;
    panel.style.transform = "";
    panel.classList.remove("dragging");
    const back = panel.animate([{ transform: from }, { transform: "none" }], { duration: SNAP.duration, easing: SNAP.easing });
    if (o) {
      o.cover.style.opacity = "";
      o.cover.animate([{ opacity: Number(coverNow ?? 1) }, { opacity: 1 }], { duration: 200, easing: "ease-out", fill: "forwards" });
      const hide = o.backdrop.animate([{ opacity: Number(backdropNow ?? 1) }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" });
      o.backdrop.style.opacity = "";
      void finishedOf(hide).then(() => {
        if (originFor(id) === o && !panel.classList.contains("dragging")) o.backdrop.remove();
      });
    }
    void finishedOf(back).then(() => {
      panel.style.willChange = "";
      panel.classList.remove("lifting");
    });
  };

  const click = (e: MouseEvent) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  panel.addEventListener("pointerdown", down);
  panel.addEventListener("pointermove", move);
  panel.addEventListener("pointerup", up);
  panel.addEventListener("pointercancel", up);
  panel.addEventListener("click", click, true);
  return () => {
    panel.removeEventListener("pointerdown", down);
    panel.removeEventListener("pointermove", move);
    panel.removeEventListener("pointerup", up);
    panel.removeEventListener("pointercancel", up);
    panel.removeEventListener("click", click, true);
  };
}
