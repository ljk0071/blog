import { ANALYTICS } from "~/consts";

/**
 * 방문 분석: GA4(유입·페이지뷰) + Clarity(녹화·히트맵) + PostHog(이벤트·퍼널).
 * 모두 브라우저에서만, hydrate 가 끝난 뒤(initAnalytics) 로드한다. 서버·prerender 에서는 아무것도 하지 않는다.
 *
 * 꺼 두는 방법: 브라우저 설정의 "추적 방지(DNT)", 또는 주소 뒤에 `?notrack=1` 한 번 (이 브라우저에서 계속 제외, `?notrack=0` 으로 해제).
 */

type Props = Record<string, string | number | boolean | undefined>;
type Gtag = (...args: unknown[]) => void;
type PostHog = typeof import("posthog-js").default;

let ph: PostHog | undefined;
let started = false;
// PostHog 는 별도 청크라 로드되기 전에 들어온 이벤트는 모았다가 보낸다.
const queue: Array<(p: PostHog) => void> = [];

const w = () => window as unknown as { dataLayer?: unknown[]; gtag?: Gtag; clarity?: (...a: unknown[]) => void };

function optedOut(): boolean {
  try {
    const flag = new URLSearchParams(location.search).get("notrack");
    if (flag === "1") localStorage.setItem("notrack", "1");
    if (flag === "0") localStorage.removeItem("notrack");
    if (localStorage.getItem("notrack") === "1") return true;
  } catch {
    // 저장소를 못 쓰면 DNT 만 확인한다
  }
  return navigator.doNotTrack === "1";
}

function loadScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function initAnalytics() {
  if (started || typeof window === "undefined" || optedOut()) return;
  started = true;

  if (ANALYTICS.ga4) {
    w().dataLayer = w().dataLayer ?? [];
    w().gtag = function () {
      // gtag.js 는 Arguments 객체 자체를 기대한다(배열로 바꾸면 동작하지 않는다)
      // eslint-disable-next-line prefer-rest-params
      w().dataLayer!.push(arguments);
    };
    w().gtag!("js", new Date());
    // SPA 라서 페이지뷰는 라우트가 바뀔 때 trackPageView 가 직접 보낸다
    w().gtag!("config", ANALYTICS.ga4, { send_page_view: false });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS.ga4}`);
  }

  if (ANALYTICS.clarity) {
    // Clarity 는 History API 를 스스로 감지해서 SPA 이동도 세션에 이어 붙인다
    const c = (w().clarity = w().clarity ?? function (...a: unknown[]) {
      ((w().clarity as unknown as { q?: unknown[] }).q ??= []).push(a);
    });
    void c;
    loadScript(`https://www.clarity.ms/tag/${ANALYTICS.clarity}`);
  }

  if (ANALYTICS.posthogKey) {
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(ANALYTICS.posthogKey, {
        api_host: ANALYTICS.posthogHost,
        capture_pageview: false, // 라우트 변경 때 직접 보낸다
        capture_pageleave: true,
        person_profiles: "identified_only"
      });
      ph = posthog;
      queue.splice(0).forEach((fn) => fn(posthog));
    });
  }
}

const withPostHog = (fn: (p: PostHog) => void) => {
  if (!started) return;
  if (ph) fn(ph);
  else queue.push(fn);
};

/** 라우트가 바뀔 때마다(첫 진입 포함) 호출한다. */
export function trackPageView(path: string) {
  if (!started) return;
  const url = location.origin + path;
  const title = document.title;
  w().gtag?.("event", "page_view", { page_path: path, page_location: url, page_title: title });
  withPostHog((p) => p.capture("$pageview", { $current_url: url, title }));
}

/** 커스텀 이벤트. GA4 와 PostHog 양쪽에 같은 이름·속성으로 보낸다. */
export function track(name: string, props: Props = {}) {
  if (!started) return;
  w().gtag?.("event", name, props);
  withPostHog((p) => p.capture(name, props));
}
