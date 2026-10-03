import { createContext, createEffect, createStore, deep, onSettled, useContext, type Element } from "solid-js";
import { idbGet, idbSet } from "./idb";

export interface ReadState {
  /** 0~1 스크롤 비율 */
  ratio: number;
  /** 마지막으로 읽은 시각 (ms) */
  at: number;
}
export type ProgressMap = Record<string, ReadState>;

const KEY = "progress";
/** 이 비율 이상이면 "다 읽음"으로 본다 */
export const DONE_RATIO = 0.96;

/**
 * 노트별 읽기 진행도.
 *  - createStore(fn, seed): IndexedDB 에서 읽어 오는 "파생 스토어". hydrate 후 브라우저에서만 계산한다(ssrSource: "client").
 *  - 쓰기는 draft 콜백(setProgress(d => { d[id] = ... })) 한 가지 방식이다.
 *  - createEffect 는 compute(deep 로 변경 추적) → apply(저장) 두 단계로 나뉜다.
 */
function createProgress() {
  const [progress, setProgress] = createStore<ProgressMap>(
    async () => (await idbGet<ProgressMap>(KEY)) ?? {},
    {},
    { ssrSource: "client", seedLoadingValue: true }
  );

  createEffect(
    () => deep(progress),
    (snapshot) => {
      void idbSet(KEY, snapshot);
    },
    { defer: true }
  );

  const record = (id: string, ratio: number) => {
    setProgress((d) => {
      d[id] = { ratio: Math.min(1, Math.max(0, ratio)), at: Date.now() };
    });
  };

  return { progress, record };
}

export type Progress = ReturnType<typeof createProgress>;
const ProgressContext = createContext<Progress>();

export function ProgressProvider(props: { children?: Element }) {
  const value = createProgress();
  onSettled(() => void idbGet(KEY));
  return <ProgressContext value={value}>{props.children}</ProgressContext>;
}

export const useProgress = () => useContext(ProgressContext);
