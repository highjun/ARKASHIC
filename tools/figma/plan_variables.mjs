/**
 * 쓰이는 CSS 토큰 82개를 Primer 의 **Figma 변수용 내보내기**(`dist/figma/`)에 맞춰 본다.
 *
 * Primer 가 이미 RGBA 0–1 값과 `reference`(별칭 대상)까지 담아 출하한다. 손으로 옮기면
 * 사본이 낡지만, 여기서 뽑으면 `@primer/primitives` 버전을 올릴 때 다시 돌리면 된다.
 */
import { readFileSync } from "node:fs";
import { out } from "./paths.mjs";
const D =
  "/home/highjun/ARKASHIC/node_modules/.pnpm/@primer+primitives@11.10.0/node_modules/@primer/primitives/dist/figma";
const j = (p) => JSON.parse(readFileSync(`${D}/${p}`, "utf8"));

const src = {
  light: [...j("themes/light.json"), ...j("dimension/dimension.json"), ...j("typography/typography.json")],
  dark: [...j("themes/dark.json"), ...j("dimension/dimension.json"), ...j("typography/typography.json")],
};
const base = { light: j("scales/light.json"), dark: j("scales/dark.json") };

/** `--fgColor-default` 와 `fgColor/default` 를 같은 것으로 본다 — 구분자만 다르다. */
const key = (s) => s.replace(/^--/, "").replace(/[-/]/g, "").toLowerCase();
const index = (rows) => {
  const m = new Map();
  for (const e of rows) if (!m.has(key(e.name))) m.set(key(e.name), e);
  return m;
};
const idx = { light: index(src.light), dark: index(src.dark) };
const baseIdx = { light: index(base.light), dark: index(base.dark) };

const used = JSON.parse(readFileSync(out("tokens.json"), "utf8"));
const found = [],
  missing = [];
for (const t of used) {
  const k = key(t.name);
  const l = idx.light.get(k),
    d = idx.dark.get(k);
  if (l && d)
    found.push({
      css: t.name,
      name: l.name,
      type: l.type,
      group: l.group ?? l.collection,
      scopes: l.scopes ?? [],
      uses: t.uses,
      light: l.value,
      dark: d.value,
      refLight: l.reference ?? null,
      refDark: d.reference ?? null,
    });
  else missing.push(t);
}
const byGroup = {};
for (const f of found) byGroup[f.group] = (byGroup[f.group] ?? 0) + 1;
console.log(`맞은 것 ${found.length} / 82`);
console.log("그룹별:", JSON.stringify(byGroup, null, 0));
console.log(`못 맞춘 것 ${missing.length}:`, missing.map((m) => m.name).join(", "));

// 별칭 대상(1계층)을 모은다 — `mode/...` 는 같은 계층 참조, `base/...` 는 원시 토큰.
const refs = new Set();
for (const f of found) for (const r of [f.refLight, f.refDark]) if (r?.startsWith("base/")) refs.add(r);
console.log(
  `base 참조 ${refs.size}개 · mode 내부 참조 ${found.filter((f) => f.refLight?.startsWith("mode/")).length}개`,
);

// ── 3계층으로 가른다 ────────────────────────────────────────────────────────
// Primer 가 붙여 준 `group` 을 그대로 쓴다. 우리가 다시 판단하면 Primer 를 올릴 때마다 갈린다.
const TIER = {
  "base/size": "Base",
  "base/typography": "Base",
  semantic: "Semantic",
  "functional/size": "Semantic",
  typography: "Semantic",
  component: "Component",
  "component (internal)": "Component",
  "pattern/size": "Component",
  syntax: "Component",
};

/** rem·px·배수 문자열을 Figma FLOAT 로 바꾼다. 루트 글꼴은 16px 이다. */
const num = (v) => {
  if (v == null) return null;
  const m = String(v)
    .trim()
    .match(/^(-?[\d.]+)(rem|px|)$/);
  if (!m) return null;
  return m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]);
};

// Primer 의 Figma 내보내기에 없는 것(spacing·lineHeight·리포 자체 토큰)은 CSS 에서 푼 값으로 채운다.
const SYNTH = {
  Semantic: [
    "--space-xs",
    "--space-sm",
    "--space-md",
    "--space-lg",
    "--text-body-lineHeight-large",
    "--text-body-lineHeight-medium",
    "--text-body-lineHeight-small",
    "--text-caption-lineHeight",
    "--text-codeBlock-lineHeight",
  ],
  Base: ["--base-text-lineHeight-tight", "--base-text-lineHeight-snug", "--base-text-lineHeight-normal"],
  Component: ["--arka-row-height"],
};
// Figma 변수로 옮길 수 없는 것 — 그림자는 이펙트 스타일, 나머지는 Figma 에 대응 개념이 없다.
const SKIP = [
  "--shadow-",
  "--motion-",
  "--zIndex-",
  "--breakpoint-",
  "--fontStack-",
  "--tab-drag-affordance-z",
  "--text-codeInline-size",
];

const plan = { Base: [], Semantic: [], Component: [] };
const rgba = (v) => (typeof v === "object" && v && "r" in v ? v : null);

for (const f of found) {
  const tier = TIER[f.group];
  if (!tier) {
    console.log("계층 미정:", f.group, f.name);
    continue;
  }
  plan[tier].push({
    css: f.css,
    name: f.name,
    type: f.type,
    scopes: f.scopes,
    light: f.light,
    dark: f.dark,
    ref: f.refLight ?? null,
    refD: f.refDark ?? null,
  });
}
for (const [tier, names] of Object.entries(SYNTH)) {
  for (const css of names) {
    const t = used.find((u) => u.name === css);
    const l = num(t?.light),
      d = num(t?.dark);
    if (l == null) {
      console.log("합성 실패:", css, t?.light);
      continue;
    }
    plan[tier].push({
      css,
      name: css.replace(/^--/, "").replace(/-/g, "/"),
      type: "FLOAT",
      scopes: [],
      light: l,
      dark: d ?? l,
      ref: null,
      synth: true,
    });
  }
}

// base 참조를 1계층 변수로 끌어온다 — 2·3계층이 별칭으로 가리킬 대상이다.
for (const r of refs) {
  // `base/color/dark/base/color/blue/5` 처럼 컬렉션 접두사가 한 번 더 붙어 온다. 떼고 찾는다.
  const short = r.replace(/^base\/(color\/(light|dark)|size|typography)\//, "");
  const l = baseIdx.light.get(key(short)) ?? idx.light.get(key(short));
  const d = baseIdx.dark.get(key(short)) ?? idx.dark.get(key(short));
  if (!l || !d) {
    console.log("base 못 찾음:", r);
    continue;
  }
  plan.Base.push({
    css: null,
    name: l.name,
    type: l.type,
    scopes: l.scopes ?? [],
    light: l.value,
    dark: d.value,
    ref: null,
    refId: r,
  });
}

// 같은 이름이 직접 쓰임과 참조 대상으로 두 번 들어올 수 있다 — 먼저 들어온 쪽(직접 쓰임)을 남긴다.
for (const tier of Object.keys(plan)) {
  const seen = new Set();
  plan[tier] = plan[tier].filter((r) => (seen.has(r.name) ? false : seen.add(r.name)));
}

// 서체는 Figma 쪽 대체를 넣는다 — Pretendard 가 Figma 에 없어 UI 는 Noto Sans KR,
// 코드는 리포와 같은 Cascadia Code 다. Primer 가 내보낸 'SF Mono' 는 여기서 안 맞는다.
for (const r of plan.Semantic)
  if (r.name === "fontStack/monospace") {
    r.light = "Cascadia Code";
    r.dark = "Cascadia Code";
  }
plan.Semantic.push({
  css: null,
  name: "fontStack/ui",
  type: "STRING",
  scopes: ["FONT_FAMILY"],
  light: "Noto Sans KR",
  dark: "Noto Sans KR",
  ref: null,
  synth: true,
});

const skipped = used.filter((u) => SKIP.some((s) => u.name.startsWith(s)));
console.log("\n── 계획 ──");
for (const [tier, rows] of Object.entries(plan)) {
  const t = {};
  for (const r of rows) t[r.type] = (t[r.type] ?? 0) + 1;
  console.log(`${tier.padEnd(10)} ${String(rows.length).padStart(3)}개  ${JSON.stringify(t)}`);
}
console.log(`옮기지 않음 ${skipped.length}개: ${skipped.map((s) => s.name).join(", ")}`);
import { writeFileSync } from "node:fs";
writeFileSync(out("variables.json"), JSON.stringify(plan, null, 1));
