import { For, Loading, Reveal, lazy } from "solid-js";
import NoteList from "~/components/NoteList";
import PageHead from "~/components/PageHead";
import PortfolioCard from "~/components/PortfolioCard";
import Principles from "~/components/Principles";
import { GraphSkeleton, NotesSkeleton, PrinciplesSkeleton } from "~/components/Skeletons";
import { PROFILE } from "~/consts";
import { notes } from "~/lib/notes";

// 정원 지도는 무겁고(시뮬레이션) 첫 화면 아래라서 별도 청크로 분리한다.
const GardenGraph = lazy(() => import("~/components/GardenGraph"));

export default function Home() {
  const recent = notes.slice(0, 6);
  return (
    <main class="wide">
      <PageHead path="/" />
      <section class="hero">
        <div class="intro">
          <p class="hand">안녕하세요, {PROFILE.role} ssobbs13입니다 👋</p>
          <h1>
            해결했다는 결과보다
            <br />
            <span class="mark">어떻게</span>를 기록하는 정원
          </h1>
          <p class="lead">
            문제가 <strong>어떻게 발생했고</strong>, <strong>어떤 방식으로 해결했는지</strong>를 파고든 기록을 씨앗처럼 심고 조금씩 다듬어 가요.
          </p>
          <p class="career muted">
            {PROFILE.career.company} · {PROFILE.role} {PROFILE.years} — 일일 약 10만 건의 주차 데이터 결제·정산·통계
          </p>
          <ul class="stack">
            <For each={PROFILE.stack}>{(s) => <li>{s}</li>}</For>
          </ul>
        </div>
        <div class="portfolio-wrap">
          <PortfolioCard />
        </div>
      </section>

      {/*
        세 구역을 Reveal 로 묶는다: 아래 구역이 먼저 준비돼도 위에서부터 차례로 공개돼서 레이아웃이 튀지 않는다.
        (Suspense 시절의 SuspenseList 가 Reveal 로 바뀌었다)
      */}
      <Reveal>
        <div class="home-principles">
          <div class="section-title">
            <h2>이렇게 일해요</h2>
            <a href="/about">더 알아보기 →</a>
          </div>
          <Loading fallback={<PrinciplesSkeleton />}>
            <Principles />
          </Loading>
        </div>

        <div>
          <div class="section-title">
            <h2>정원 지도</h2>
            <span class="hand">노드를 끌어보고, 눌러보세요!</span>
          </div>
          <Loading fallback={<GraphSkeleton />}>
            <GardenGraph />
          </Loading>
        </div>

        <div>
          <div class="section-title">
            <h2>최근에 심은 노트</h2>
            <a href="/blog">전체 보기 →</a>
          </div>
          <Loading fallback={<NotesSkeleton count={3} />}>
            <NoteList notes={recent} />
          </Loading>
        </div>
      </Reveal>
    </main>
  );
}
