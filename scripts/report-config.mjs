// src/consts.ts 의 SITE_URL 에서 호스트만 뽑는다. 보고서가 운영 호스트의 트래픽만 세도록 필터하는 데 쓴다.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/consts.ts"), "utf8");
export const ANALYTICS_HOST = new URL(src.match(/SITE_URL\s*=\s*'([^']+)'/)[1]).host;
