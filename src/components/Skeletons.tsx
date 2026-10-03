import { Repeat } from "solid-js";

/** 노트 카드 모양 스켈레톤. <Loading fallback> 으로 쓴다. */
export function NoteCardSkeleton() {
  return (
    <li>
      <div class="note card note-skeleton" aria-hidden="true">
        <span class="skel skel-pill" />
        <span class="skel skel-title" />
        <span class="skel skel-line" />
        <span class="skel skel-line" style={{ width: "85%" }} />
        <span class="skel skel-line" style={{ width: "55%" }} />
      </div>
    </li>
  );
}

/** count 개 만큼의 카드 스켈레톤. 위치 인덱스만 필요하므로 diff 가 없는 Repeat 이 맞다. */
export function NotesSkeleton(props: { count?: number }) {
  return (
    <ul class="notes" role="status" aria-label="노트를 불러오는 중">
      <Repeat count={props.count ?? 3}>{() => <NoteCardSkeleton />}</Repeat>
    </ul>
  );
}

/** 글 본문 스켈레톤 */
export function ArticleSkeleton() {
  return (
    <div class="article-skeleton" role="status" aria-label="본문을 불러오는 중">
      <span class="skel skel-title" style={{ width: "40%" }} />
      <Repeat count={4}>{(i) => <span class="skel skel-line" style={{ width: `${100 - (i % 3) * 12}%` }} />}</Repeat>
      <span class="skel skel-block" />
      <span class="skel skel-title" style={{ width: "55%" }} />
      <Repeat count={3}>{(i) => <span class="skel skel-line" style={{ width: `${96 - (i % 2) * 18}%` }} />}</Repeat>
    </div>
  );
}

export function GraphSkeleton() {
  return <div class="skel graph-skeleton" role="status" aria-label="정원 지도를 불러오는 중" />;
}

export function PrinciplesSkeleton() {
  return (
    <ul class="principles" aria-hidden="true">
      <Repeat count={3}>
        {() => (
          <li class="card">
            <span class="skel" style={{ width: "1.6rem", height: "1.6rem" }} />
            <div style={{ flex: 1 }}>
              <span class="skel skel-line" style={{ width: "50%" }} />
              <span class="skel skel-line" />
            </div>
          </li>
        )}
      </Repeat>
    </ul>
  );
}
