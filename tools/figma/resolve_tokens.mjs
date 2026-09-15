/**
 * 코드가 실제로 쓰는 CSS 토큰만 추려 라이트/다크 값으로 푼다.
 *
 * Primer 전체를 옮기면 수천 개다. 화면에 안 쓰는 변수는 Figma 에서도 쓸 일이 없으니
 * `packages/client/src/**\/*.css` 가 `var()` 로 부른 것만 가져온다.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { out } from "./paths.mjs";

const DIST =
  "/home/highjun/ARKASHIC/node_modules/.pnpm/@primer+primitives@11.10.0/node_modules/@primer/primitives/dist/css";
const SRC = "/home/highjun/ARKASHIC/packages/client/src";

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

/** `--name: value;` 선언만 긁는다. 선택자는 안 본다 — 한 파일이 한 테마다. */
const decls = (file) => {
  const map = new Map();
  for (const m of readFileSync(file, "utf8").matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
};

const all = walk(DIST).filter((f) => f.endsWith(".css"));
const isTheme = (f) => f.includes(`${path.sep}themes${path.sep}`);
const common = new Map();
for (const f of all.filter((f) => !isTheme(f))) for (const [k, v] of decls(f)) common.set(k, v);

// 리포가 스스로 정한 것 — Primer 에 없다.
common.set("--arka-row-height", "28px");

const theme = (name) => {
  const m = new Map(common);
  for (const [k, v] of decls(path.join(DIST, "functional/themes", `${name}.css`))) m.set(k, v);
  return m;
};
const modes = { light: theme("light"), dark: theme("dark") };

/** `var(--a, fallback)` 사슬을 끝까지 편다. */
const resolve = (raw, map, seen = new Set()) => {
  if (raw == null) return null;
  let out = raw;
  for (let i = 0; i < 12 && out.includes("var("); i += 1) {
    out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, name, fb) => {
      if (seen.has(name)) return fb ?? "";
      seen.add(name);
      return map.get(name) ?? fb ?? "";
    });
  }
  return out.trim();
};

// 쓰이는 토큰 수집
const used = new Map();
for (const f of walk(SRC).filter((f) => f.endsWith(".css"))) {
  for (const m of readFileSync(f, "utf8").matchAll(/var\(\s*(--[\w-]+)/g)) {
    used.set(m[1], (used.get(m[1]) ?? 0) + 1);
  }
}

const rows = [...used.keys()].sort().map((name) => {
  const l = resolve(modes.light.get(name), modes.light);
  const d = resolve(modes.dark.get(name), modes.dark);
  return { name, uses: used.get(name), light: l || null, dark: d || null, varies: l !== d };
});

writeFileSync(out("tokens.json"), JSON.stringify(rows, null, 1));
const missing = rows.filter((r) => r.light == null && r.dark == null);
console.log(
  `쓰이는 토큰 ${rows.length}개 · 모드마다 다른 것 ${rows.filter((r) => r.varies).length}개 · 못 찾음 ${missing.length}개`,
);
if (missing.length) console.log("못 찾음:", missing.map((r) => r.name).join(", "));
