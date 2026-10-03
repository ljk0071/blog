import { useBookmarks } from "~/lib/bookmarks";

/** 낙관적 업데이트: 누르는 즉시 눌린 상태가 되고, 저장이 끝나면 원본과 맞춰진다. */
export default function BookmarkButton(props: { id: string }) {
  const bookmarks = useBookmarks();
  return (
    <button
      type="button"
      class="bookmark-btn"
      aria-pressed={bookmarks.has(props.id) ? "true" : "false"}
      data-saving={bookmarks.saving() ? "" : undefined}
      onClick={() => bookmarks.toggle(props.id)}
    >
      {bookmarks.has(props.id) ? "🔖 저장됨" : "🔖 읽을 목록에 저장"}
    </button>
  );
}
