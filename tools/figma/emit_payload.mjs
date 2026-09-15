/**
 * `variables.json`(3계층 계획)을 Figma 에 밀어 넣을 payload 로 줄인다.
 *
 * 줄 하나가 `[이름, 형(C|F|S), Light 값, Dark 값, Light 별칭, Dark 별칭]` 이다.
 * **Dark 값만** `0` 으로 "Light 와 같음"을 뜻한다. 별칭 자리는 `null` 이 "없음"이라
 * 뭉개지지 않는다 — 처음엔 둘 다 `0` 으로 적었다가 알파 변형 넷이 엉뚱한 색이 됐다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { out as outPath } from "./paths.mjs";

const plan = JSON.parse(readFileSync(outPath("variables.json"), "utf8"));
const strip = (r) =>
  r ? r.replace(/^base\/(color\/(light|dark)|size|typography)\//, "").replace(/^mode\//, "") : null;
const hex = (v) => {
  if (typeof v !== "object" || !v) return v;
  const h = (n) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return "#" + h(v.r) + h(v.g) + h(v.b) + (v.a != null && v.a < 1 ? h(v.a) : "");
};

// 모든 계층의 이름 → 모드별 값. 별칭을 걸어도 값이 같은지 여기서 본다.
const val = new Map();
for (const rows of Object.values(plan)) for (const r of rows) val.set(r.name, { l: hex(r.light), d: hex(r.dark) });

const out = {};
let kept = 0,
  demoted = 0,
  dangling = 0;
for (const [tier, rows] of Object.entries(plan)) {
  out[tier] = rows.map((r) => {
    const l = hex(r.light),
      d = hex(r.dark);
    /** 별칭은 알파를 못 싣는다 — 참조값과 내 값이 다르면 별칭을 버리고 값을 그대로 둔다. */
    const pick = (ref, mode, mine) => {
      const n = strip(ref);
      if (!n) return null;
      const t = val.get(n);
      if (!t) {
        dangling += 1;
        return null;
      }
      if (t[mode] !== mine) {
        demoted += 1;
        return null;
      }
      kept += 1;
      return n;
    };
    return [r.name, r.type[0], l, d === l ? 0 : d, pick(r.ref, "l", l), pick(r.refD ?? r.ref, "d", d)];
  });
}
writeFileSync(outPath("vp.json"), JSON.stringify(out));
const total = Object.values(out).reduce((a, v) => a + v.length, 0);
console.log(
  `변수 ${total} · 별칭 ${kept}칸 · 값으로 내림 ${demoted} · 대상 없음 ${dangling} · ${(JSON.stringify(out).length / 1024).toFixed(1)}KB`,
);
