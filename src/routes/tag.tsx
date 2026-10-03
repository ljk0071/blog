import { useParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import NoteList from "~/components/NoteList";
import PageHead from "~/components/PageHead";
import { notesByTag } from "~/lib/notes";

export default function Tag() {
  const params = useParams<{ tag: string }>();
  const tag = () => decodeURIComponent(params.tag);
  const list = createMemo(() => notesByTag(tag()));
  return (
    <main class="wide">
      <PageHead title={`#${tag()}`} description={`#${tag()} 태그의 노트 ${list().length}개`} path={`/tags/${encodeURIComponent(tag())}`} />
      <div class="section-title first">
        <h1>#{tag()}</h1>
        <span class="hand">{list().length}개의 노트</span>
      </div>
      <NoteList notes={list()} />
      <p>
        <a href="/tags">← 모든 화단</a>
      </p>
    </main>
  );
}
