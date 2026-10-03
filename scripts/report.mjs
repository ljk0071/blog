#!/usr/bin/env node
/**
 * 주간 방문 분석 보고서. `node scripts/report.mjs [--end YYYY-MM-DD] [--dry]`
 *  - 기간: end(기본 어제)까지 7일 = 이번 주, 그 앞 7일 = 지난주. 날짜는 REPORT_TZ(기본 Asia/Seoul) 기준.
 *  - 출력: reports/YYYY-WW.md (ISO 주차). --dry 면 파일 대신 stdout.
 *  - 키(.env, 커밋 금지): GA4_PROPERTY_ID, GA4_SA_JSON_PATH, POSTHOG_PERSONAL_KEY, CLARITY_TOKEN
 *    선택: POSTHOG_HOST(기본 https://us.posthog.com), EXCLUDE_DISTINCT_IDS(내 브라우저 id, 쉼표 구분)
 *  - 외부 의존성 없음. 도구별로 실패해도 나머지는 계속 만들고, 실패 사유는 보고서에 그대로 적는다.
 */
import { createSign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ANALYTICS_HOST } from "./report-config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // .env 가 없으면 이미 export 된 환경변수만 쓴다
}
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);

// ───────── 기간 ─────────
const DAY = 86400000;
const ymd = (d) => d.toISOString().slice(0, 10);
// 날짜 경계는 PostHog 프로젝트·GA4 속성의 시간대와 맞춘다 (둘 다 그 시간대의 달력 날짜로 조회한다)
const TZ = process.env.REPORT_TZ || "Asia/Seoul";
const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()) + "T00:00:00Z");
const endDay = opt("end") ? new Date(opt("end") + "T00:00:00Z") : new Date(+today - DAY);
const W = {
  cur: { from: new Date(+endDay - 6 * DAY), to: endDay },
  prev: { from: new Date(+endDay - 13 * DAY), to: new Date(+endDay - 7 * DAY) }
};
const MAU_FROM = new Date(+endDay - 29 * DAY);
const COHORT_FROM = new Date(+endDay - 8 * 7 * DAY);
const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const w = Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / DAY + 1) / 7);
  return `${t.getUTCFullYear()}-${String(w).padStart(2, "0")}`;
};

// ───────── 공통 ─────────
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "–");
const delta = (a, b) => (b ? `${a >= b ? "+" : ""}${(((a - b) / b) * 100).toFixed(0)}%` : a ? "신규" : "–");
const num = (n) => (n == null ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 }));
const table = (head, rows) =>
  rows.length ? [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n") : "_데이터 없음_";
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const SMALL = 30; // 이 미만이면 해석 위험 표시
const small = (n) => (n < SMALL ? ` ⚠️표본 ${n}` : "");
const failures = [];
async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    failures.push(`${label}: ${e.message}`);
    return null;
  }
}

// ───────── GA4 (서비스 계정 JWT → Data API) ─────────
const b64u = (b) => Buffer.from(b).toString("base64url");
async function ga4Token() {
  const sa = JSON.parse(readFileSync(process.env.GA4_SA_JSON_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(
    JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })
  );
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(sa.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${sig}` })
  });
  if (!r.ok) throw new Error(`토큰 ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}
let gaTok;
async function ga4(dimensions, metrics, range, extra = {}) {
  gaTok ??= await ga4Token();
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${gaTok}`, "content-type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: ymd(range.from), endDate: ymd(range.to) }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      dimensionFilter: { filter: { fieldName: "hostName", stringFilter: { value: ANALYTICS_HOST } } }, // 로컬·미리보기 호스트 제외
      limit: 10000,
      ...extra
    })
  });
  if (!r.ok) throw new Error(`GA4 ${r.status} ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j.rows ?? []).map((row) => [...row.dimensionValues.map((v) => v.value), ...row.metricValues.map((v) => Number(v.value))]);
}
// 표준 보고서는 처리에 24~48시간이 걸린다. 그 사이 계측이 살아 있는지는 실시간 API(최근 30분)로 본다.
async function ga4Realtime() {
  gaTok ??= await ga4Token();
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runRealtimeReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${gaTok}`, "content-type": "application/json" },
    body: JSON.stringify({ dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }] })
  });
  if (!r.ok) throw new Error(`GA4 realtime ${r.status} ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()).rows ?? []).map((row) => `${row.dimensionValues[0].value} ${row.metricValues[0].value}`);
}
const ga4Total = async (metric, range) => (await ga4([], [metric], range))[0]?.[0] ?? 0;

// ───────── PostHog (HogQL) ─────────
const PH = (process.env.POSTHOG_HOST || "https://us.posthog.com").replace(/\/$/, "");
const excluded = (process.env.EXCLUDE_DISTINCT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
// 운영 호스트 + 내 id 제외. (봇은 posthog-js 가 UA 로 걸러서 보내지 않는다)
// 봇: posthog-js 가 알려진 봇 UA 는 버리지만, 'Googlebot' 토큰 없이 오는 구글 렌더러(Nexus 5X Build/MMB29P)는 통과한다 → UA 로 추가 제외.
const BOT_UA = ["%Nexus 5X Build/MMB29P%", "%HeadlessChrome%", "%Lighthouse%"];
const BASE =
  `properties.$host = ${q(ANALYTICS_HOST)}` +
  BOT_UA.map((p) => ` AND coalesce(properties.$raw_user_agent, '') NOT ILIKE ${q(p)}`).join("") +
  (excluded.length ? ` AND distinct_id NOT IN (${excluded.map(q).join(",")})` : "");
const at = (d) => `toDateTime(${q(ymd(d) + " 00:00:00")})`;
const inRange = (r) => `timestamp >= ${at(r.from)} AND timestamp < ${at(new Date(+r.to + DAY))}`;
async function hogql(query) {
  const r = await fetch(`${PH}/api/projects/@current/query/`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.POSTHOG_PERSONAL_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } })
  });
  if (!r.ok) throw new Error(`PostHog ${r.status} ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).results ?? [];
}
const phOne = async (query) => (await hogql(query))[0]?.[0] ?? 0;

// ───────── Clarity (Data Export API: 최근 1~3일, 하루 10회 제한) ─────────
async function clarity(dimension) {
  const u = new URL("https://www.clarity.ms/export-data/api/v1/project-live-insights");
  u.searchParams.set("numOfDays", "3");
  if (dimension) u.searchParams.set("dimension1", dimension);
  const r = await fetch(u, { headers: { authorization: `Bearer ${process.env.CLARITY_TOKEN}` } });
  if (!r.ok) throw new Error(`Clarity ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json(); // [{ metricName, information: [{...}] }]
}

// ───────── 수집 ─────────
const have = {
  ga4: !!(process.env.GA4_PROPERTY_ID && process.env.GA4_SA_JSON_PATH),
  ph: !!process.env.POSTHOG_PERSONAL_KEY,
  cl: !!process.env.CLARITY_TOKEN
};
for (const [k, ok, names] of [
  ["GA4", have.ga4, "GA4_PROPERTY_ID, GA4_SA_JSON_PATH"],
  ["PostHog", have.ph, "POSTHOG_PERSONAL_KEY"],
  ["Clarity", have.cl, "CLARITY_TOKEN"]
])
  if (!ok) failures.push(`${k}: 키 없음 (${names}) — 이 도구의 지표는 모두 건너뜀`);

const gaUsers = (r) => ga4Total("activeUsers", r);
const [wau, wauPrev, mau, gaNew, gaNewPrev, gaSessions, gaViews, gaViewsPrev, gaSrc, gaPageEvents, gaEvents] = have.ga4
  ? await Promise.all([
      safe("GA4 WAU", () => gaUsers(W.cur)),
      safe("GA4 WAU(지난주)", () => gaUsers(W.prev)),
      safe("GA4 MAU", () => gaUsers({ from: MAU_FROM, to: endDay })),
      safe("GA4 신규", () => ga4Total("newUsers", W.cur)),
      safe("GA4 신규(지난주)", () => ga4Total("newUsers", W.prev)),
      safe("GA4 세션", () => ga4Total("sessions", W.cur)),
      safe("GA4 page_view", async () => (await ga4(["eventName"], ["eventCount"], W.cur, { dimensionFilter: andHost({ fieldName: "eventName", stringFilter: { value: "page_view" } }) }))[0]?.[1] ?? 0),
      safe("GA4 page_view(지난주)", async () => (await ga4(["eventName"], ["eventCount"], W.prev, { dimensionFilter: andHost({ fieldName: "eventName", stringFilter: { value: "page_view" } }) }))[0]?.[1] ?? 0),
      safe("GA4 유입", () => ga4(["sessionSource", "sessionMedium"], ["sessions"], W.cur, { orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 5 })),
      safe("GA4 경로별 page_view", () => ga4(["pagePath"], ["eventCount"], W.cur, { dimensionFilter: andHost({ fieldName: "eventName", stringFilter: { value: "page_view" } }), orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 200 })),
      safe("GA4 이벤트별 건수", () => ga4(["eventName"], ["eventCount"], W.cur))
    ])
  : Array(11).fill(null);

function andHost(f) {
  return { andGroup: { expressions: [{ filter: { fieldName: "hostName", stringFilter: { value: ANALYTICS_HOST } } }, { filter: f }] } };
}

const phRun = have.ph;
const [phWau, phWauPrev, phMau, phViews, phViewsPrev, phEvents, phEventsPrev, phDaily, phPaths, phWeeklyActive] = phRun
  ? await Promise.all([
      safe("PH WAU", () => phOne(`SELECT count(DISTINCT distinct_id) FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange(W.cur)}`)),
      safe("PH WAU(지난주)", () => phOne(`SELECT count(DISTINCT distinct_id) FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange(W.prev)}`)),
      safe("PH MAU", () => phOne(`SELECT count(DISTINCT distinct_id) FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange({ from: MAU_FROM, to: endDay })}`)),
      safe("PH $pageview", () => phOne(`SELECT count() FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange(W.cur)}`)),
      safe("PH $pageview(지난주)", () => phOne(`SELECT count() FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange(W.prev)}`)),
      safe("PH 이벤트 건수", () => hogql(`SELECT event, count(), count(DISTINCT distinct_id) FROM events WHERE ${BASE} AND ${inRange(W.cur)} GROUP BY event ORDER BY 2 DESC LIMIT 100`)),
      safe("PH 이벤트 건수(지난주)", () => hogql(`SELECT event, count() FROM events WHERE ${BASE} AND ${inRange(W.prev)} GROUP BY event LIMIT 100`)),
      safe("PH 일별 DAU", () => hogql(`SELECT toDate(timestamp) d, count(DISTINCT distinct_id) FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange({ from: MAU_FROM, to: endDay })} GROUP BY d ORDER BY d LIMIT 100`)),
      safe("PH 경로별 $pageview", () => hogql(`SELECT properties.$pathname, count(), count(DISTINCT distinct_id) FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange(W.cur)} GROUP BY 1 ORDER BY 2 DESC LIMIT 200`)),
      safe("PH 코호트용 주별 활동", () => hogql(`SELECT DISTINCT distinct_id, toString(toStartOfWeek(timestamp, 1)) FROM events WHERE event='$pageview' AND ${BASE} AND ${inRange({ from: COHORT_FROM, to: endDay })} LIMIT 100000`))
    ])
  : Array(10).fill(null);

const evRows = phRun
  ? await safe("PH 노트 이벤트", () =>
      hogql(
        `SELECT distinct_id, event, toString(timestamp), properties.note, properties.source, properties.saved, properties.query
         FROM events WHERE event IN ('note_open','note_read_complete','bookmark_toggle','search') AND ${BASE} AND ${inRange(W.cur)} ORDER BY timestamp LIMIT 100000`
      )
    )
  : null;
const scrollRows = phRun
  ? await safe("PH 스크롤 깊이", () =>
      hogql(
        `SELECT properties.$prev_pageview_pathname p, avg(toFloat(properties.$prev_pageview_max_scroll_percentage)), count()
         FROM events WHERE event IN ('$pageleave','$pageview') AND ${BASE} AND ${inRange(W.cur)} AND properties.$prev_pageview_pathname LIKE '/blog/%' GROUP BY p ORDER BY 3 DESC LIMIT 100`
      )
    )
  : null;
const vitals = phRun
  ? await safe("PH Web Vitals", async () => {
      const out = {};
      for (const m of ["LCP", "INP", "CLS"])
        out[m] = (await hogql(`SELECT quantile(0.75)(toFloat(properties.$web_vitals_${m}_value)), count() FROM events WHERE event='$web_vitals' AND ${BASE} AND ${inRange(W.cur)} AND properties.$web_vitals_${m}_value IS NOT NULL`))[0] ?? [null, 0];
      return out;
    })
  : null;
const phErrors = phRun
  ? await safe("PH JS 에러", () =>
      hogql(`SELECT properties.$exception_types, properties.$exception_values, count() FROM events WHERE event='$exception' AND ${BASE} AND ${inRange(W.cur)} GROUP BY 1,2 ORDER BY 3 DESC LIMIT 5`)
    )
  : null;
const clInsights = have.cl ? await safe("Clarity 인사이트", () => clarity("URL")) : null;

// GA4 표준 보고서가 통째로 비어 있는데 PostHog 에는 방문이 있으면 "방문 0"이 아니라 처리 지연이다
const gaLagging = have.ga4 && gaEvents && gaEvents.length === 0 && (phViews ?? 0) > 0;
const gaRealtime = gaLagging ? await safe("GA4 실시간", ga4Realtime) : null;
const notes = [];
if (gaLagging)
  notes.push(
    `GA4 표준 보고서에 이 기간 데이터가 아직 없습니다. PostHog 에는 페이지뷰 ${phViews}건이 있으므로 GA4 의 처리 지연(보통 24~48시간)입니다. 아래 GA4 값 0 은 "방문 없음"이 아닙니다. ` +
      `GA4 실시간(최근 30분): ${gaRealtime?.length ? gaRealtime.join(", ") : "이벤트 없음"}`
  );

// ───────── 가공 ─────────
const evMap = (rows) => Object.fromEntries((rows ?? []).map((r) => [r[0], r]));
const ev = evMap(phEvents);
const evPrev = evMap(phEventsPrev);

// 코호트 리텐션: 첫 방문 주 → +1주/+2주에 다시 방문한 비율. 완전히 지난 주만 계산한다.
function cohorts() {
  if (!phWeeklyActive) return null;
  const weeks = new Map(); // id -> Set(week)
  for (const [id, w] of phWeeklyActive) (weeks.get(id) ?? weeks.set(id, new Set()).get(id)).add(w);
  const wk = (s, n) => ymd(new Date(+new Date(s + "T00:00:00Z") + n * 7 * DAY));
  const lastFullWeekStart = ymd(new Date(+endDay - 6 * DAY)); // 이번 주 시작(월요일이 아닐 수 있어 보수적으로)
  const byFirst = new Map();
  for (const [id, set] of weeks) {
    const first = [...set].sort()[0];
    (byFirst.get(first) ?? byFirst.set(first, []).get(first)).push(id);
  }
  return [...byFirst.entries()]
    .sort()
    .filter(([first]) => first > ymd(COHORT_FROM)) // 조회 첫 주는 "기존 방문자"가 섞여 있어 제외
    .map(([first, ids]) => {
      const r = (n) => (wk(first, n) < lastFullWeekStart ? ids.filter((id) => weeks.get(id).has(wk(first, n))).length : null);
      return [first, ids.length, r(1), r(2)];
    });
}

// 노트별 퍼널/진입 경로/북마크/검색
function noteStats() {
  if (!evRows) return null;
  const opens = new Map(); // note -> Map(person -> source(첫 진입))
  const done = new Map(); // note -> Set(person)
  const people = new Set();
  const saved = new Set();
  const searches = [];
  const byPerson = new Map();
  for (const [id, event, ts, note, source, savedProp, query] of evRows) {
    const t = +new Date(ts.replace(" ", "T") + (ts.endsWith("Z") ? "" : "Z"));
    (byPerson.get(id) ?? byPerson.set(id, []).get(id)).push([event, t]);
    if (event === "note_open") {
      people.add(id);
      const m = opens.get(note) ?? opens.set(note, new Map()).get(note);
      if (!m.has(id)) m.set(id, source);
    } else if (event === "note_read_complete") (done.get(note) ?? done.set(note, new Set()).get(note)).add(id);
    else if (event === "bookmark_toggle" && (savedProp === true || savedProp === "true")) saved.add(id);
    else if (event === "search") searches.push([id, t, String(query).toLowerCase()]);
  }
  const notes = [...opens.entries()].map(([note, m]) => {
    const readers = (src) => [...m].filter(([, s]) => !src || s === src);
    const cnt = (src) => readers(src).length;
    const fin = (src) => readers(src).filter(([id]) => done.get(note)?.has(id)).length;
    return { note, opens: m.size, done: fin(), card: [cnt("card"), fin("card")], direct: [cnt("direct"), fin("direct")], link: [cnt("link"), fin("link")] };
  });
  // 검색 후 이탈: 5분 안에 같은 사람의 note_open 이 없으면 이탈
  const WIN = 5 * 60000;
  const terms = new Map();
  let left = 0;
  for (const [id, t, query] of searches) {
    const followed = byPerson.get(id).some(([e, et]) => e === "note_open" && et > t && et <= t + WIN);
    if (!followed) left++;
    const s = terms.get(query) ?? terms.set(query, { n: 0, left: 0 }).get(query);
    s.n++;
    if (!followed) s.left++;
  }
  return { notes, openers: people.size, bookmarkers: [...saved].filter((id) => people.has(id)).length, searches: searches.length, left, terms };
}
const ns = noteStats();

// ───────── 작성 ─────────
const label = isoWeek(endDay);
const range = (r) => `${ymd(r.from)} ~ ${ymd(r.to)}`;
const L = [];
const sec = (title, ...body) => L.push(`\n## ${title}\n`, ...body);

const summary = [];
if (wau && !gaLagging) summary.push(`WAU ${num(wau)} (지난주 대비 ${delta(wau, wauPrev)}, GA4)`);
else if (phWau != null) summary.push(`WAU ${num(phWau)} (지난주 대비 ${delta(phWau, phWauPrev)}, PostHog)`);
if (ns?.notes.length) {
  const o = ns.notes.reduce((s, n) => s + n.opens, 0);
  const d = ns.notes.reduce((s, n) => s + n.done, 0);
  summary.push(`노트 완독률 ${pct(d, o)}${small(o)}`);
}
L.push(`# 주간 방문 보고서 ${label}`, "", `- 이번 주 ${range(W.cur)} / 지난주 ${range(W.prev)} (${TZ})`, `- **이번 주 한 줄 요약:** ${summary.length ? summary.join(" · ") : "수집된 지표 없음 — 아래 '수집 실패' 확인"}`);

if (notes.length) sec("참고", notes.map((n) => `- ${n}`).join("\n"));
if (failures.length) sec("⚠️ 수집 실패 / 건너뜀", failures.map((f) => `- ${f}`).join("\n"));

sec(
  "0. 계측 상태 (이번 주 이벤트 유입)",
  table(
    ["이벤트", "PostHog 건수", "PostHog 사용자", "GA4 건수", "상태"],
    ["$pageview", "note_open", "search", "bookmark_toggle", "note_read_complete", "theme_toggle", "graph_node_click", "$pageleave", "$web_vitals", "$exception"].map((e) => {
      const gaName = e === "$pageview" ? "page_view" : e;
      const ga = gaLagging ? null : (gaEvents ?? []).find((r) => r[0] === gaName)?.[1];
      const p = ev[e];
      const status = !phRun ? "PostHog 키 없음" : p ? "✅" : "❌ 0건 (미발화 또는 미수집)";
      return [e, num(p?.[1] ?? 0), num(p?.[2] ?? 0), e.startsWith("$") && e !== "$pageview" ? "n/a" : gaLagging ? "지연" : gaEvents ? num(ga ?? 0) : "–", status];
    })
  ),
  "",
  `**페이지뷰 교차 검증** — GA4 page_view ${num(gaViews)} (지난주 ${num(gaViewsPrev)}) vs PostHog $pageview ${num(phViews)} (지난주 ${num(phViewsPrev)})` +
    (gaViews && phViews ? `, 비율 GA4/PostHog = ${(gaViews / phViews).toFixed(2)}` : "") +
    "\n- 같은 코드가 두 곳에 한 번씩 보내므로 1.0 근처가 정상. 약 2.0 이면 GA4 '향상된 측정'의 '브라우저 기록 이벤트 기반 페이지 변경'이 켜져 이중 집계 중. 0.8 아래면 GA4 쪽이 광고 차단기에 더 잘 막히는 것(GA4 도메인이 차단 목록에 더 흔함)이거나 누락.",
  "- 도구 간 차이가 정상인 이유: GA4(googletagmanager.com)와 PostHog(us.i.posthog.com)는 광고 차단기 차단율이 다르고, GA4 는 알려진 봇을 자체 필터링하며, 사용자 수는 GA4(activeUsers·쿠키 기반)와 PostHog(distinct_id·localStorage 기반)의 식별 방식이 달라 일치하지 않는다."
);

sec(
  "1. 성장",
  table(
    ["지표", "이번 주", "지난주", "증감", "출처"],
    [
      ["WAU", num(wau), num(wauPrev), delta(wau, wauPrev), "GA4"],
      ["WAU", num(phWau), num(phWauPrev), delta(phWau, phWauPrev), "PostHog"],
      ["MAU(30일)", num(mau), "–", "–", "GA4"],
      ["MAU(30일)", num(phMau), "–", "–", "PostHog"],
      ["신규 사용자", num(gaNew), num(gaNewPrev), delta(gaNew, gaNewPrev), "GA4"],
      ["재방문 사용자", wau != null && gaNew != null ? num(wau - gaNew) : "–", wauPrev != null && gaNewPrev != null ? num(wauPrev - gaNewPrev) : "–", wau != null && gaNew != null && wauPrev != null && gaNewPrev != null ? delta(wau - gaNew, wauPrev - gaNewPrev) : "–", "GA4"],
      ["세션", num(gaSessions), "–", "–", "GA4"]
    ]
  ),
  small(wau ?? phWau ?? 0) ? `\n해석 주의:${small(wau ?? phWau ?? 0)} — 증감 %는 절대 인원이 적으면 한두 명 차이로 크게 흔들립니다.` : "",
  "",
  "**유입 경로 Top 5 (GA4 세션)**",
  table(["source / medium", "세션"], (gaSrc ?? []).map((r) => [esc(`${r[0]} / ${r[1]}`), num(r[2])])),
  "",
  "**액션 후보:** 유입 1위 채널을 확인하고, 그 채널에 맞는 글(공유 카드 문구·OG 이미지)을 한 편 다듬는다. `(direct) / (none)` 이 대부분이면 링크 공유 경로를 늘리는 쪽이 먼저."
);

const dau = phDaily?.slice(-28).map((r) => r[1]) ?? [];
const avgDau = dau.length ? dau.reduce((a, b) => a + b, 0) / dau.length : null;
const co = cohorts();
sec(
  "2. 리텐션 (PostHog)",
  `- DAU/MAU(28일 평균 DAU ÷ 30일 MAU): **${avgDau != null && phMau ? pct(avgDau, phMau) : "–"}** (평균 DAU ${num(avgDau)}, MAU ${num(phMau)})${small(phMau ?? 0)}`,
  "",
  "코호트 = 해당 주에 처음 $pageview 가 잡힌 브라우저. W1/W2 = 그 다음 1/2주에 다시 방문한 비율. 아직 끝나지 않은 주는 '–'.",
  table(["첫 방문 주(월)", "코호트 크기", "W1", "W2"], (co ?? []).map(([w, n, r1, r2]) => [w, n + (n < SMALL ? " ⚠️" : ""), r1 == null ? "–" : `${pct(r1, n)} (${r1})`, r2 == null ? "–" : `${pct(r2, n)} (${r2})`])),
  "",
  "- 주의: distinct_id 가 브라우저 단위 익명 id 라 기기·시크릿 창·저장소 삭제 때마다 새 사람으로 집계됩니다. 리텐션은 실제보다 낮게, 신규는 높게 나옵니다.",
  "",
  "**액션 후보:** W1 이 낮으면 글 끝에 '다음에 읽을 글'(같은 태그)과 구독/북마크 유도를 넣는다. 코호트가 30 미만이면 몇 주 더 모은 뒤 판단."
);

const pvByPath = new Map((phPaths ?? []).map((r) => [r[0], { views: r[1], users: r[2] }]));
sec(
  "3. 콘텐츠",
  "**노트별 조회수 (PostHog $pageview, /blog/*)**",
  table(
    ["노트", "조회수", "사용자"],
    [...pvByPath].filter(([p]) => String(p).startsWith("/blog/")).slice(0, 10).map(([p, v]) => [esc(p), num(v.views), num(v.users)])
  ),
  "",
  "**완독 퍼널 (PostHog, 사람 단위: note_open → note_read_complete)**",
  ns
    ? table(
        ["노트", "열람", "완독", "완독률", "평균 스크롤"],
        [...ns.notes]
          .sort((a, b) => b.opens - a.opens)
          .slice(0, 10)
          .map((n) => {
            const sc = scrollRows?.find((r) => r[0] === `/blog/${n.note}` || r[0] === `/blog/${n.note}/`);
            return [esc(n.note), n.opens, n.done, pct(n.done, n.opens) + (n.opens < SMALL ? " ⚠️표본" : ""), sc ? `${(sc[1] * 100).toFixed(0)}% (n=${sc[2]})` : "–"];
          })
      )
    : "_데이터 없음_",
  "",
  "- 평균 스크롤 깊이 = 다음 `$pageview`(사이트 안 이동) 또는 `$pageleave`(이탈)에 실려 오는 `$prev_pageview_max_scroll_percentage`. 탭을 그냥 닫거나 모바일에서 백그라운드로 가면 빠질 수 있습니다(과소 집계)."
);
if (ns) {
  const sum = (k) => ns.notes.reduce((s, n) => [s[0] + n[k][0], s[1] + n[k][1]], [0, 0]);
  const [c, d, l] = [sum("card"), sum("direct"), sum("link")];
  L.push(
    "",
    "**card vs direct 진입 (PostHog)**",
    table(
      ["진입", "열람", "완독", "완독률"],
      [
        ["card(목록 카드 클릭)", c[0], c[1], pct(c[1], c[0]) + (c[0] < SMALL ? " ⚠️표본" : "")],
        ["direct(주소·외부 링크)", d[0], d[1], pct(d[1], d[0]) + (d[0] < SMALL ? " ⚠️표본" : "")],
        ["link(다른 노트에서 이어 읽기)", l[0], l[1], pct(l[1], l[0]) + (l[0] < SMALL ? " ⚠️표본" : "")]
      ]
    ),
    "",
    `**북마크 전환율:** 노트를 연 ${ns.openers}명 중 ${ns.bookmarkers}명이 북마크 저장 = **${pct(ns.bookmarkers, ns.openers)}**${small(ns.openers)} (PostHog)`
  );
}
L.push("", "**액션 후보:** 조회수 상위인데 완독률이 낮은 노트는 도입부·길이를 손본다. direct 완독률이 card 보다 높으면 외부 유입 독자가 더 몰입한다는 뜻이니 그쪽 채널을 키운다.");

sec(
  "4. 검색 (PostHog)",
  ns
    ? [
        `검색 ${ns.searches}회, 검색 후 5분 내 노트를 열지 않고 이탈 ${ns.left}회 = **${pct(ns.left, ns.searches)}**${small(ns.searches)}`,
        "",
        table(
          ["검색어", "횟수", "이탈"],
          [...ns.terms].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([t, s]) => [esc(t), s.n, s.left])
        ),
        "",
        "- 타이핑 중 300ms 멈출 때마다 이벤트가 나가므로 `rea` → `react` 처럼 한 번의 검색이 여러 건으로 잡힙니다(과대 집계). 이탈 판정은 '5분 내 같은 브라우저의 note_open 없음' 휴리스틱입니다."
      ].join("\n")
    : "_데이터 없음_",
  "",
  "**액션 후보:** 이탈이 높은 검색어는 '찾는 글이 없다'는 신호이니 해당 주제의 글감 후보로 올린다."
);

const clMetric = (name) => clInsights?.find((m) => m.metricName === name)?.information ?? [];
const clSum = (name, key) => clMetric(name).reduce((s, r) => s + Number(r[key] ?? 0), 0);
sec(
  "5. 품질",
  "**Web Vitals p75 (PostHog `$web_vitals`)**",
  vitals && Object.values(vitals).some((v) => v[1] > 0)
    ? table(
        ["지표", "p75", "표본", "기준(Good)"],
        [["LCP", `${num(vitals.LCP[0])} ms`, vitals.LCP[1], "≤ 2500 ms"], ["INP", `${num(vitals.INP[0])} ms`, vitals.INP[1], "≤ 200 ms"], ["CLS", num(vitals.CLS[0]), vitals.CLS[1], "≤ 0.1"]].map((r) => (r[2] < SMALL ? [...r.slice(0, 2), `${r[2]} ⚠️`, r[3]] : r))
      )
    : !phRun
      ? "_PostHog 키 없음_"
      : "0건. 이번 주에 Web Vitals 이벤트가 없습니다(방문 자체가 없었거나, Safari 처럼 일부 지표를 보고하지 않는 브라우저뿐이었을 수 있음).",
  "",
  "**JS 에러 (PostHog `$exception`)**",
  phErrors?.length ? table(["종류", "메시지", "건수"], phErrors.map((r) => [esc(r[0]), esc(r[1]).slice(0, 80), r[2]])) : !phRun ? "_PostHog 키 없음_" : "0건 (2026-10-04 배포부터 수집. 그 전 기간의 0건은 '에러 없음'이 아니라 '수집 안 함')",
  "",
  `**Clarity (최근 3일만 조회 가능 — API 제한. 이번 주 7일 전체가 아님)**`,
  clInsights
    ? table(
        ["지표", "건수", "발생한 페이지"],
        [["Dead click", "DeadClickCount"], ["Rage click", "RageClickCount"], ["Quick back", "QuickbackClick"], ["Script error", "ScriptErrorCount"]].map(([n, k]) => [
          n,
          num(clSum(k, "subTotal")),
          esc(clMetric(k).filter((r) => Number(r.subTotal) > 0).sort((a, b) => b.subTotal - a.subTotal).slice(0, 3).map((r) => `${new URL(r.Url).pathname} (${r.subTotal})`).join(", ") || "–")
        ])
      )
    : "_수집 안 됨_",
  "",
  "**액션 후보:** Rage/Dead click 은 Clarity 에서 해당 URL 녹화를 열어 어떤 요소인지 확인(링크처럼 보이는 비링크 등). Quick back 이 높은 페이지는 첫 화면이 기대와 다른 것이니 제목·요약을 손본다. Web Vitals 는 LCP 가 나쁘면 이미지·폰트 로딩부터."
);

sec(
  "6. 제외 방법과 한계",
  [
    "- **동의한 방문만:** 사이트가 opt-in 이라 '허용'을 누른 브라우저의 방문만 데이터에 있습니다. 모든 수치는 실제 방문보다 작고, 허용한 사람 쪽으로 치우쳐 있습니다. 절대값보다 주간 추세와 비율을 보세요.",
    "- **내 방문:** 알림에서 거부했거나 `?notrack=1` 로 접속한 브라우저는 도구를 로드하지 않아 데이터에 없습니다. 그 밖에 허용한 내 브라우저가 있다면 그 id 를 `.env` 의 `EXCLUDE_DISTINCT_IDS` 로 PostHog 쿼리에서 뺄 수 있습니다" + (excluded.length ? ` (현재 ${excluded.length}개 제외 중).` : " (현재 미설정)."),
    `- **로컬/미리보기:** GA4 는 hostName=${ANALYTICS_HOST}, PostHog 는 $host=${ANALYTICS_HOST} 로 필터해 localhost·*.pages.dev 를 뺍니다.`,
    "- **봇:** GA4 는 IAB 목록 기반 봇을 자체 제외하고, posthog-js 는 알려진 봇 UA 를 보내지 않습니다. PostHog 쿼리에서는 추가로 구글 렌더러(Nexus 5X Build/MMB29P)·HeadlessChrome·Lighthouse UA 를 뺍니다. GA4 수치에는 이 추가 제외가 적용되지 않아 PostHog 보다 높게 나올 수 있습니다. 1회 세션에 페이지뷰 1개이고 체류시간 0초인 트래픽이 갑자기 늘면 의심하세요.",
    `- **시간대:** 날짜 경계는 ${TZ} 입니다. PostHog 프로젝트와 GA4 속성의 시간대가 이와 다르면 하루 경계의 수치가 어긋나므로 .env 의 REPORT_TZ 를 맞추세요.`
  ].join("\n")
);

const out = L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
if (flag("dry")) process.stdout.write(out);
else {
  const file = join(root, "reports", `${label}.md`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, out);
  console.log(`wrote ${file}${failures.length ? ` (실패 ${failures.length}건 — 보고서 상단 참고)` : ""}`);
}
