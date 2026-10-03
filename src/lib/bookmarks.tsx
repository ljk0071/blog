import {
  action,
  createContext,
  createOptimistic,
  createOptimisticStore,
  createSignal,
  onSettled,
  refresh,
  useContext,
  type Element
} from "solid-js";
import { track } from "./analytics";
import { idbGet, idbSet } from "./idb";

export interface Saved {
  id: string;
  /** 저장한 시각 (ms) */
  at: number;
}

const KEY = "bookmarks";

const readSaved = async (): Promise<Saved[]> => (await idbGet<Saved[]>(KEY)) ?? [];

/**
 * 읽을 목록(북마크).
 *
 * 백엔드 없이도 쓸 수 있는 "비동기 저장소"(IndexedDB) 위에서 Solid 2.0 의 낙관적 업데이트를 쓴다:
 *  - createOptimisticStore(fn, seed): 저장소에서 읽는 파생 스토어. 쓰기는 transition 이 끝나면 원본 값으로 되돌아간다.
 *  - action(function*): 낙관적 쓰기 → 실제 저장(yield) → refresh 로 원본과 맞춘다. 저장이 실패하면 낙관적 값은 자동으로 사라진다.
 *  - ssrSource: "client" + seedLoadingValue: 서버는 빈 목록을 렌더하고, 실제 값은 hydrate 후 브라우저에서만 읽는다.
 */
function createBookmarks() {
  const [saved, setSaved] = createOptimisticStore<Saved[]>(() => readSaved(), [], {
    ssrSource: "client",
    seedLoadingValue: true,
    key: "id"
  });

  const has = (id: string) => saved.some((s) => s.id === id);

  // "저장 중…" 같은 진행 표시는 isPending 이 아니라, 액션 안에서 같이 쓰는 낙관적 플래그로 만든다(transition 이 끝나면 false 로 되돌아간다).
  const [saving, setSaving] = createOptimistic(false);
  // 저장소 첫 읽기가 끝났는가 (목록 페이지가 빈 상태 대신 스켈레톤을 보여 주려고 쓴다)
  const [ready, setReady] = createSignal(false);
  onSettled(() => {
    void readSaved().then(() => setReady(true));
  });

  const toggle = action(function* (id: string) {
    const wasSaved = saved.some((s) => s.id === id);
    setSaving(true);
    track("bookmark_toggle", { note: id, saved: !wasSaved });
    // 1) 낙관적 쓰기: 저장이 끝나기 전에 화면에는 이미 반영된다
    setSaved((list) => {
      if (wasSaved) {
        const i = list.findIndex((s) => s.id === id);
        if (i >= 0) list.splice(i, 1);
      } else {
        list.unshift({ id, at: Date.now() });
      }
    });
    // 2) 실제 저장 (IndexedDB 는 비동기라서 진짜 "서버 왕복"처럼 동작한다)
    const current = yield readSaved();
    const next = wasSaved ? current.filter((s: Saved) => s.id !== id) : [{ id, at: Date.now() }, ...current.filter((s: Saved) => s.id !== id)];
    yield idbSet(KEY, next);
    // 3) 원본과 맞춘다 (같은 질문을 다시 묻는 것이라 isPending 은 켜지지 않는다)
    yield refresh(saved);
  });

  return { saved, has, toggle, saving, ready };
}

export type Bookmarks = ReturnType<typeof createBookmarks>;

const BookmarksContext = createContext<Bookmarks>();

export function BookmarksProvider(props: { children?: Element }) {
  const value = createBookmarks();
  return <BookmarksContext value={value}>{props.children}</BookmarksContext>;
}

export const useBookmarks = () => useContext(BookmarksContext);
