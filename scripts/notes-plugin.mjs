// 마크다운 노트를 가상 모듈로 노출하는 Vite 플러그인.
//   virtual:notes          → 메타데이터 배열 (작아서 메인 번들에 포함)
//   virtual:note-bodies    → { [id]: () => import("virtual:note-body/<id>") }  (노트마다 코드 분할)
//   virtual:note-body/<id> → 본문 HTML 문자열
//   virtual:search-index   → 검색용 { id, text } 배열 (검색을 처음 쓸 때 비동기로 로드)
import path from "node:path";
import { loadNotes } from "./content-core.mjs";

const PREFIX = "\0";
const BODY = "virtual:note-body/";

export default function notesPlugin({ dir }) {
  let root = process.cwd();
  let isBuild = false;
  let promise;
  const abs = () => path.resolve(root, dir);
  const notes = () =>
    (promise ??= loadNotes(abs()).then((all) => (isBuild ? all.filter((n) => !n.draft) : all)));

  return {
    name: "garden-notes",
    configResolved(config) {
      root = config.root;
      isBuild = config.command === "build";
    },
    resolveId(id) {
      if (id === "virtual:notes" || id === "virtual:note-bodies" || id === "virtual:search-index" || id.startsWith(BODY)) {
        return PREFIX + id;
      }
    },
    async load(id) {
      if (!id.startsWith(PREFIX)) return;
      const name = id.slice(PREFIX.length);
      const all = await notes();
      if (name === "virtual:notes") {
        const meta = all.map(({ html, text, ...rest }) => rest);
        return `export const notes = ${JSON.stringify(meta)};`;
      }
      if (name === "virtual:note-bodies") {
        const entries = all.map((n) => `  ${JSON.stringify(n.id)}: () => import(${JSON.stringify(BODY + n.id)})`);
        return `export const bodies = {\n${entries.join(",\n")}\n};`;
      }
      if (name === "virtual:search-index") {
        const index = all.map((n) => ({ id: n.id, text: n.text }));
        return `export default ${JSON.stringify(index)};`;
      }
      if (name.startsWith(BODY)) {
        const note = all.find((n) => n.id === name.slice(BODY.length));
        if (!note) throw new Error(`unknown note: ${name}`);
        return `export default ${JSON.stringify(note.html)};`;
      }
    },
    configureServer(server) {
      server.watcher.add(abs());
      const onChange = (file) => {
        if (!file.startsWith(abs())) return;
        promise = undefined;
        for (const env of Object.values(server.environments)) {
          for (const mod of env.moduleGraph.idToModuleMap.values()) {
            if (mod.id?.startsWith(PREFIX + "virtual:")) env.moduleGraph.invalidateModule(mod);
          }
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", onChange).on("add", onChange).on("unlink", onChange);
    }
  };
}
