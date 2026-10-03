// 마크다운 노트를 빌드 타임에 컴파일하는 코어. Vite 플러그인(가상 모듈)과 prerender 스크립트가 함께 쓴다.
// frontmatter → 메타데이터, 본문 → HTML(shiki 듀얼 테마), 제목 목록(TOC), 노트 간 링크, 검색용 순수 텍스트.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";
import { createHighlighter } from "shiki";

const STAGES = new Set(["seedling", "budding", "evergreen"]);

let highlighterPromise;
const getHighlighter = () =>
  (highlighterPromise ??= createHighlighter({ themes: ["vitesse-light", "vitesse-dark"], langs: [] }));

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decodeEntities = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

const toIsoDate = (value, field, file) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${file}: frontmatter '${field}' is not a valid date (${String(value)})`);
  return d.toISOString().slice(0, 10);
};

async function compileMarkdown(source, ids) {
  const hl = await getHighlighter();
  const headings = [];
  const links = new Set();
  const seen = new Map();

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const text = decodeEntities(html.replace(/<[^>]+>/g, ""));
        let id = slugify(text) || "section";
        const n = seen.get(id) ?? 0;
        seen.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth === 2 || depth === 3) headings.push({ depth, id, text });
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = (lang ?? "").split(/\s+/)[0];
        if (language && !hl.getLoadedLanguages().includes(language)) {
          // 동기 렌더러 안에서는 언어를 로드할 수 없으므로, 미리 로드되지 않은 언어는 평문으로 둔다.
          return `<pre class="shiki"><code>${escapeHtml(text)}</code></pre>\n`;
        }
        return hl.codeToHtml(text, {
          lang: language || "text",
          themes: { light: "vitesse-light", dark: "vitesse-dark" },
          defaultColor: "light"
        });
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const m = /^\/blog\/([^/?#]+)\/?$/.exec(href ?? "");
        if (m && ids?.has(m[1])) links.add(m[1]);
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        const external = /^https?:\/\//.test(href ?? "");
        const rel = external ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${escapeHtml(href ?? "")}"${t}${rel}>${text}</a>`;
      }
    }
  });

  // 코드 블록 언어를 한 번에 로드한다 (렌더러는 동기라서 사전 스캔).
  const langs = new Set();
  for (const m of source.matchAll(/^```([\w+-]+)/gm)) langs.add(m[1]);
  for (const lang of langs) {
    try {
      await hl.loadLanguage(lang);
    } catch {
      // 알 수 없는 언어는 평문 처리
    }
  }

  const html = marked.parse(source, { async: false });
  const text = decodeEntities(html.replace(/<pre[\s\S]*?<\/pre>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return { html, headings, links: [...links], text };
}

/** `dir` 아래 *.md 를 모두 컴파일해 pubDate 내림차순으로 돌려준다. */
export async function loadNotes(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const ids = new Set(files.map((f) => f.replace(/\.md$/, "")));
  const notes = [];
  for (const file of files) {
    const id = file.replace(/\.md$/, "");
    const raw = await readFile(path.join(dir, file), "utf8");
    const { data, content } = matter(raw);
    for (const key of ["title", "description", "pubDate"]) {
      if (data[key] == null) throw new Error(`${file}: frontmatter '${key}' is required`);
    }
    const stage = data.stage ?? "seedling";
    if (!STAGES.has(stage)) throw new Error(`${file}: stage must be one of ${[...STAGES].join(", ")}`);
    const compiled = await compileMarkdown(content, ids);
    notes.push({
      id,
      title: String(data.title),
      description: String(data.description),
      pubDate: toIsoDate(data.pubDate, "pubDate", file),
      updatedDate: data.updatedDate ? toIsoDate(data.updatedDate, "updatedDate", file) : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      stage,
      draft: Boolean(data.draft),
      minutes: Math.max(1, Math.round(content.length / 500)),
      links: compiled.links.filter((l) => l !== id),
      headings: compiled.headings,
      html: compiled.html,
      text: compiled.text
    });
  }
  return notes.sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.id.localeCompare(b.id));
}
