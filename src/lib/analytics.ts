import { ANALYTICS } from "~/consts";

/**
 * 방문 분석: GA4(유입·페이지뷰) + Clarity(녹화·히트맵) + PostHog(이벤트·퍼널).
 * 모두 브라우저에서만, hydrate 가 끝난 뒤(initAnalytics) 로드한다. 서버·prerender 에서는 아무것도 하지 않는다.
 *
 * 동의: 유럽에서 접속하면 허용한 경우에만 로드한다(opt-in). 그 밖의 지역은 기본으로 로드하고 거부할 수 있다(opt-out).
 * 첫 방문 알림(AnalyticsNotice)이나 /privacy 의 스위치로 고른다(setConsent).
 * 주소 뒤에 `?notrack=1` 을 한 번 붙이면 거부로 저장된다(`?notrack=0` 으로 해제).
 */

type Props = Record<string, string | number | boolean | undefined>;
type Gtag = (...args: unknown[]) => void;
type PostHog = typeof import("posthog-js").default;

let ph: PostHog | undefined;
let started = false;
// 이번 페이지 로드에서 도구 스크립트를 불러온 적이 있는가
let loaded = false;
// PostHog 는 별도 청크라 로드되기 전에 들어온 이벤트는 모았다가 보낸다.
const queue: Array<(p: PostHog) => void> = [];

const w = () => window as unknown as { dataLayer?: unknown[]; gtag?: Gtag; clarity?: (...a: unknown[]) => void };

export type Consent = "granted" | "denied" | "unset";
const CONSENT_KEY = "analytics-consent";

/**
 * 이 브라우저의 방문 분석 동의 상태 (브라우저 전용). 허용한 브라우저에서만 수집한다(opt-in).
 * 거부(notrack) > 허용 > DNT 순으로 본다: 직접 허용했다면 브라우저의 DNT 보다 그 선택을 따른다.
 */
export function consent(): Consent {
  try {
    const flag = new URLSearchParams(location.search).get("notrack");
    if (flag === "1") localStorage.setItem("notrack", "1");
    if (flag === "0") localStorage.removeItem("notrack");
    if (localStorage.getItem("notrack") === "1") return "denied";
    if (localStorage.getItem(CONSENT_KEY) === "granted") return "granted";
  } catch {
    // 저장소를 못 쓰면 선택을 기억할 수 없다 → 수집하지 않는다
    return "denied";
  }
  return navigator.doNotTrack === "1" ? "denied" : "unset";
}

/**
 * 사전 동의가 필요한 지역인가. 정적 사이트라 접속 국가를 알 수 없어 브라우저 시간대로 추정한다.
 * 유럽 시간대(EU·EEA·영국·스위스를 넓게 포함)와 유럽에 속한 대서양·북극 섬이면 true. 시간대를 알 수 없으면 필요한 쪽으로 본다.
 */
export function needsConsent(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return !tz || /^(Europe\/|Arctic\/Longyearbyen$|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$)/.test(tz);
  } catch {
    return true;
  }
}

/** 지금 이 브라우저에서 수집해도 되는가: 허용했거나, 아직 고르지 않았고 사전 동의가 필요 없는 지역일 때 */
export const trackingAllowed = () => {
  const c = consent();
  return c === "granted" || (c === "unset" && !needsConsent());
};

// Clarity 는 유럽(EEA·영국·스위스) 방문에서 이 신호를 받아야 쿠키를 써서 세션을 잇고 녹화를 남긴다. 광고에는 쓰지 않는다.
const signalClarityConsent = () => w().clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });

/**
 * 방문자의 선택을 저장하고 바로 적용한다.
 * 허용하면 그 자리에서 도구를 불러오고 지금 보고 있는 페이지부터 기록한다. 거부하면 그 자리에서 멈춘다.
 */
export function setConsent(granted: boolean) {
  try {
    if (granted) {
      localStorage.removeItem("notrack");
      localStorage.setItem(CONSENT_KEY, "granted");
    } else {
      localStorage.removeItem(CONSENT_KEY);
      localStorage.setItem("notrack", "1");
    }
  } catch {
    return; // 기억할 수 없으면 수집하지 않는다
  }
  if (granted) {
    // 기본 수집 지역에서 이미 수집 중이면 선택만 기억하고 Clarity 에 알린다
    if (started) return void signalClarityConsent();
    // 이번 방문에서 한 번 멈춘 도구는 되살리지 않고 새로 불러온다
    if (loaded) return location.reload();
    initAnalytics();
    trackPageView(location.pathname);
    return;
  }
  if (!started) return;
  started = false; // track·trackPageView 가 더 보내지 않는다
  (window as unknown as Record<string, unknown>)[`ga-disable-${ANALYTICS.ga4}`] = true;
  w().clarity?.("consent", false); // Clarity 쿠키를 지운다
  w().clarity?.("stop");
  ph?.opt_out_capturing();
}

// 봇 UA 목록에 없어 각 도구의 필터를 통과하는 자동화 브라우저. 'Nexus 5X Build/MMB29P' 는 구글 렌더러의 고정 프로필이다.
const isAutomated = () => navigator.webdriver || /Nexus 5X Build\/MMB29P|HeadlessChrome|Lighthouse/.test(navigator.userAgent);

function loadScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function initAnalytics() {
  if (started || typeof window === "undefined" || !trackingAllowed() || isAutomated()) return;
  started = true;
  loaded = true;

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
    // 직접 허용한 방문자만 알린다 (스크립트가 뜨기 전이면 위의 큐에 쌓였다가 처리된다)
    if (consent() === "granted") signalClarityConsent();
  }

  if (ANALYTICS.posthogKey) {
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(ANALYTICS.posthogKey, {
        api_host: ANALYTICS.posthogHost,
        capture_pageview: false, // 라우트 변경 때 직접 보낸다
        capture_pageleave: true,
        // 프로젝트 원격 설정에 기대지 않고 코드에서 켠다: 잡히지 않은 에러·거부된 Promise, LCP/INP/CLS
        capture_exceptions: true,
        capture_performance: { web_vitals: true },
        person_profiles: "identified_only"
      });
      // 이 브라우저에서 한 번 거부했다가 다시 허용한 경우, PostHog 에 남아 있는 거부 표시를 푼다
      if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false });
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
