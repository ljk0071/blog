import { Script } from "@solidjs/meta";
import { useBeforeLeave, useParams, type RoutePreloadFuncArgs } from "@solidjs/router";
import { For, Loading, Show, createMemo, isPending, onCleanup, onSettled } from "solid-js";
import BookmarkButton from "~/components/BookmarkButton";
import NoteList from "~/components/NoteList";
import PageHead from "~/components/PageHead";
import { ReadingBar, ResumeButton, Toc, createReadingTracker } from "~/components/ReadingTools";
import { ArticleSkeleton } from "~/components/Skeletons";
import { SITE_TITLE, SITE_URL, STAGES } from "~/consts";
import { backlinksOf, formatDate, getNoteBody, noteById, relatedOf } from "~/lib/notes";
import { bindSwipeBack, canAnimateExit, dropOrigin, hasOrigin, playEnter, playExit, releaseAfterExit } from "~/lib/reader";

export const preload = ({ params }: RoutePreloadFuncArgs) => void getNoteBody(params.id!);

export default function NotePage() {
  const params = useParams<{ id: string }>();
  // 노트 메타(제목·태그 등)는 동기 데이터. 라우트의 matchFilters 가 존재하는 id 만 통과시킨다.
  const note = createMemo(() => noteById.get(params.id)!);
  const stage = () => STAGES[note().stage];

  // 본문은 노트마다 따로 분할된 청크 → 비동기 memo.
  //  · 서버: deferStream 으로 본문이 HTML 에 그대로 들어가게 첫 flush 를 기다린다.
  //  · 클라이언트 첫 진입: <Loading> 이 스켈레톤을 보여 준다.
  //  · 노트 → 노트 이동: 이미 한 번 보인 자리라 이전 글이 그대로 남고(isPending 으로 흐리게), 새 글이 도착하면 한 번에 바뀐다.
  const body = createMemo(() => getNoteBody(params.id), { deferStream: true });

  const { ratio, current } = createReadingTracker(() => note().id);

  let panel!: HTMLDivElement;
  let header!: HTMLElement;
  let exiting = false;
  let dragGeometry: Parameters<typeof playExit>[2];

  onSettled(() => {
    // 카드에서 열렸다면 카드 → 글 FLIP 으로 펼친다
    playEnter(note().id, { panel, header });
    // 오른쪽으로 끌어 닫기 (카드에서 열었을 때만 뒤에 목록이 있다)
    const unbind = bindSwipeBack({
      id: note().id,
      panel,
      header,
      onDismiss: (geometry) => {
        dragGeometry = geometry;
        history.back();
      }
    });
    return unbind;
  });

  // 뒤로 가기를 가로채 패널이 카드로 줄어든 뒤 이동을 이어 간다 (iOS 스와이프처럼 브라우저가 이미 애니메이션했으면 건너뜀)
  useBeforeLeave((e) => {
    const id = params.id;
    if (exiting || !canAnimateExit(id, e.to)) return;
    e.preventDefault();
    exiting = true;
    void playExit(id, { panel, header }, dragGeometry).then(() => e.retry(true));
  });
  onCleanup(() => (exiting ? releaseAfterExit() : dropOrigin()));

  const back = (e: MouseEvent) => {
    if (hasOrigin(note().id)) {
      e.preventDefault();
      history.back();
    }
  };

  const jsonLd = () =>
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: note().title,
      description: note().description,
      datePublished: note().pubDate,
      dateModified: note().updatedDate ?? note().pubDate,
      keywords: note().tags.join(", "),
      url: `${SITE_URL}/blog/${note().id}`,
      author: { "@type": "Person", name: "ssobbs13" }
    });

  return (
    <main>
      <PageHead title={note().title} description={note().description} path={`/blog/${note().id}`} type="article" />
      <Script type="application/ld+json">{jsonLd()}</Script>
      <ReadingBar ratio={ratio} />

      <div class="reader reader-lift" ref={panel}>
        <div class="reader-sheet" aria-hidden="true" />
        <div class="reader-bar" data-fade="chrome">
          <a href="/blog" onClick={back}>
            ← 목록으로
          </a>
          <span class="hand">오른쪽으로 밀어서 닫기</span>
        </div>

        <article>
          <header class="post-header card note-header" ref={header}>
            <p class="stage-line">
              <span class="stage-pill" title={stage().hint}>
                {stage().emoji} {stage().label}
              </span>
              <span class="hand" data-fade="chrome">
                {stage().hint}
              </span>
            </p>
            <h1>{note().title}</h1>
            <p class="post-meta">
              <span>
                심은 날 <time datetime={note().pubDate}>{formatDate(note().pubDate)}</time>
              </span>
              <Show when={note().updatedDate}>
                {(d) => (
                  <span>
                    마지막으로 돌본 날 <time datetime={d()}>{formatDate(d())}</time>
                  </span>
                )}
              </Show>
              <span>{note().minutes}분</span>
            </p>
            <p class="post-tags">
              <For each={note().tags}>
                {(t) => (
                  <a class="tag" href={`/tags/${encodeURIComponent(t)}`}>
                    #{t}
                  </a>
                )}
              </For>
            </p>
            <div class="post-actions">
              <BookmarkButton id={note().id} />
              <ResumeButton id={note().id} />
            </div>
          </header>

          <Toc note={note()} current={current} />

          <div data-fade="body">
            <Loading fallback={<ArticleSkeleton />}>
              <div class="prose" data-pending={isPending(() => body()) ? "" : undefined} innerHTML={body()} />
            </Loading>
          </div>
        </article>

        <Show when={backlinksOf(note().id).length > 0}>
          <section data-fade="body">
            <div class="section-title">
              <h2>이 노트를 언급한 곳</h2>
              <span class="hand">backlinks</span>
            </div>
            <NoteList notes={backlinksOf(note().id)} />
          </section>
        </Show>
        <Show when={relatedOf(note()).length > 0}>
          <section data-fade="body">
            <div class="section-title">
              <h2>같은 화단의 노트</h2>
              <span class="hand">같은 태그</span>
            </div>
            <NoteList notes={relatedOf(note())} />
          </section>
        </Show>
      </div>
    </main>
  );
}
