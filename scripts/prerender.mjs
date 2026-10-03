// 빌드 후 처리: 모든 라우트를 SSR 로 한 번씩 렌더해 정적 HTML 로 굽고, RSS·사이트맵·robots.txt·_headers 를 만든 뒤
// dist/client 를 dist/ 로 끌어올려 Cloudflare Pages 가 그대로 서빙할 수 있는 형태로 완성한다.
//
//   vite build  →  dist/client (자산) + dist/server/server.js (handleRequest)
//   prerender   →  dist/*.html, dist/blog/<id>.html, ..., dist/404.html, dist/rss.xml, ...
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadNotes } from "./content-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");

const constants = await readFile(path.join(root, "src/consts.ts"), "utf8");
const pick = (name) => new RegExp(`${name}\\s*=\\s*'([^']*)'`).exec(constants)?.[1];
const SITE_URL = pick("SITE_URL");
const SITE_TITLE = pick("SITE_TITLE");
const SITE_DESCRIPTION = pick("SITE_DESCRIPTION");
if (!SITE_URL || !SITE_TITLE) throw new Error("src/consts.ts 에서 SITE_URL / SITE_TITLE 을 읽지 못했어요");

const { handleRequest } = await import(pathToFileURL(path.join(dist, "server/server.js")).href);
const notes = (await loadNotes(path.join(root, "src/content/blog"))).filter((n) => !n.draft);

const pageFile = (urlPath) => {
  const clean = decodeURIComponent(urlPath).replace(/^\/+|\/+$/g, "");
  return path.join(client, clean ? `${clean}.html` : "index.html");
};

async function render(urlPath) {
  const res = await handleRequest(new Request(`http://localhost${urlPath}`));
  return { status: res.status, html: await res.text() };
}

// ---------- 1. 페이지 prerender (링크를 따라가며 크롤링) ----------
const tags = [...new Set(notes.flatMap((n) => n.tags))];
const queue = ["/", "/blog", "/tags", "/saved", "/about", "/privacy", ...notes.map((n) => `/blog/${n.id}`), ...tags.map((t) => `/tags/${encodeURIComponent(t)}`)];
const done = new Map();

while (queue.length) {
  const urlPath = queue.shift();
  if (done.has(urlPath)) continue;
  const { status, html } = await render(urlPath);
  if (status !== 200) throw new Error(`${urlPath} → HTTP ${status}`);
  if (!html.includes("<title") || !html.includes("</html>")) throw new Error(`${urlPath}: 완성된 HTML 이 아니에요`);
  if (urlPath.startsWith("/blog/") && /article-skeleton/.test(html)) throw new Error(`${urlPath}: 본문 대신 스켈레톤이 구워졌어요 (deferStream 확인)`);
  const file = pageFile(urlPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  done.set(urlPath, html.length);

  for (const m of html.matchAll(/<a [^>]*href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (/\.[a-z0-9]+$/i.test(href) || done.has(href)) continue; // 파일(rss.xml 등)은 제외
    queue.push(href);
  }
}

// ---------- 2. 404 ----------
{
  const { status, html } = await render("/__not-found__");
  if (status !== 404) throw new Error(`404 페이지가 HTTP ${status} 를 돌려줬어요 (httpStatus(404) 확인)`);
  await writeFile(path.join(client, "404.html"), html);
}

// ---------- 3. RSS · 사이트맵 · robots · _headers ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = (iso) => new Date(`${iso}T00:00:00Z`).toUTCString();

await writeFile(
  path.join(client, "rss.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${esc(SITE_TITLE)}</title>
<link>${SITE_URL}</link>
<description>${esc(SITE_DESCRIPTION ?? "")}</description>
<language>ko</language>
${notes
  .map(
    (n) => `<item>
<title>${esc(n.title)}</title>
<link>${SITE_URL}/blog/${n.id}</link>
<guid isPermaLink="true">${SITE_URL}/blog/${n.id}</guid>
<pubDate>${rfc822(n.pubDate)}</pubDate>
<description>${esc(n.description)}</description>
${n.tags.map((t) => `<category>${esc(t)}</category>`).join("")}
</item>`
  )
  .join("\n")}
</channel></rss>
`
);

const lastmod = new Map(notes.map((n) => [`/blog/${n.id}`, n.updatedDate ?? n.pubDate]));
const urls = [...done.keys()].filter((p) => p !== "/saved");
await writeFile(
  path.join(client, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((p) => `<url><loc>${SITE_URL}${p === "/" ? "" : p}</loc>${lastmod.has(p) ? `<lastmod>${lastmod.get(p)}</lastmod>` : ""}</url>`).join("\n")}
</urlset>
`
);
await writeFile(path.join(client, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile(
  path.join(client, "_headers"),
  `/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`
);

// ---------- 4. dist/client → dist/ 로 끌어올리고 서버 번들 제거 ----------
await rm(path.join(client, ".vite"), { recursive: true, force: true });
for (const name of await readdir(client)) await cp(path.join(client, name), path.join(dist, name), { recursive: true });
await rm(client, { recursive: true, force: true });
await rm(path.join(dist, "server"), { recursive: true, force: true });

console.log(`prerendered ${done.size} pages + 404.html, rss.xml, sitemap.xml, robots.txt, _headers`);
for (const [p, size] of done) console.log(`  ${p.padEnd(44)} ${(size / 1024).toFixed(1)} KB`);
