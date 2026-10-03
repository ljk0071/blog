import { Show, createMemo } from "solid-js";
import NoteList from "~/components/NoteList";
import PageHead from "~/components/PageHead";
import { NotesSkeleton } from "~/components/Skeletons";
import { useBookmarks } from "~/lib/bookmarks";
import { noteById, type NoteMeta } from "~/lib/notes";

export default function Saved() {
  const bookmarks = useBookmarks();
  // 저장한 id → 노트 메타. 저장소는 브라우저에만 있어서(IndexedDB) 서버는 빈 목록을 렌더하고, hydrate 후 채운다.
  const list = createMemo(() => bookmarks.saved.map((s) => noteById.get(s.id)).filter((n): n is NoteMeta => !!n));
  return (
    <main class="wide">
      <PageHead title="읽을 목록" description="나중에 읽으려고 저장해 둔 노트" path="/saved" noindex />
      <div class="section-title first">
        <h1>읽을 목록</h1>
        <span class="hand">이 기기에만 저장돼요</span>
      </div>
      <Show when={bookmarks.ready()} fallback={<NotesSkeleton count={2} />}>
        <NoteList notes={list()} empty="아직 저장한 노트가 없어요. 노트에서 🔖 를 눌러 보세요." />
      </Show>
    </main>
  );
}
