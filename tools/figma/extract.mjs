/**
 * 스토리북의 **실제 렌더 결과**를 Figma 레이어 트리(html-figma LayerNode)로 뽑는다.
 *
 * 컴포넌트가 `@primer/react` 래퍼라서 CSS만 보고 손으로 베끼면 Primer 내부 기하를 놓친다.
 * 진짜 브라우저에 띄워 계산된 스타일째로 직렬화하는 편이 정확하고 싸다.
 * 나온 JSON은 브리지의 `import_html_layers`가 그대로 먹는다.
 */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { CLIENT_OUT, OUT as OUT_ROOT, STORYBOOK } from "./paths.mjs";

const STATIC = STORYBOOK;
const OUT_NAME = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "stories";
const OUT = path.resolve(CLIENT_OUT, OUT_NAME);
const BUNDLE = path.join(OUT_ROOT, "tools", "html-figma.bundle.js");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".map": "application/json",
};

const serve = () =>
  new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://x");
      const file = path.join(STATIC, decodeURIComponent(url.pathname));
      if (!file.startsWith(STATIC) || !existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });

const full = process.argv.includes("--full");
const forceDark = process.argv.includes("--dark");
const forceLight = process.argv.includes("--light");
// 모드별로 따로 담는다 — 한 벌을 덮으면 다른 벌이 사라진다.
// `--stage 1440x900` — 스토리 데코레이터가 못 박아 둔 상자 크기를 덮어쓴다.
// 뷰 스토리는 1100x640 같은 작은 상자에 갇혀 있어, 실제 데스크톱 크기로 보려면 이게 필요하다.
const stageArg = process.argv[process.argv.indexOf("--stage") + 1];
const stage =
  process.argv.includes("--stage") && /^\d+x\d+$/.test(stageArg ?? "")
    ? { w: Number(stageArg.split("x")[0]), h: Number(stageArg.split("x")[1]) }
    : null;
const ids = process.argv
  .slice(2)
  .filter((a, i, all) => !a.startsWith("--") && all[i - 1] !== "--stage" && all[i - 1] !== "--out");
if (ids.length === 0) {
  console.error("스토리 id를 인자로 준다");
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const { server, port } = await serve();
const browser = await chromium.launch();
// 디바이스 픽셀비 1 — html-figma 는 CSS 픽셀을 쓰므로 배율이 끼면 좌표가 어긋난다.
const page = await browser.newPage({
  viewport: { width: Math.max(1280, (stage?.w ?? 0) + 40), height: Math.max(900, (stage?.h ?? 0) + 40) },
  deviceScaleFactor: 1,
});
const bundle = await readFile(BUNDLE, "utf8");

const results = [];
const failed = [];
for (const id of ids) {
  const dest = path.join(OUT, `${id}.json`);
  if (existsSync(dest) && !process.argv.includes("--force")) {
    continue;
  }
  try {
    await page.goto(`http://127.0.0.1:${port}/iframe.html?id=${id}&viewMode=story`, { waitUntil: "load" });
    // 다크 한 벌로 그린다 — Figma 로컬 변수에 모드가 하나뿐이다(Starter 제한).
    await page.locator("#storybook-root").waitFor({ state: "attached" });
    // `--empty` 처럼 아무것도 안 그리는 스토리가 있다. visible 을 기다리면 거기서 멈춘다 —
    // 내용이 생기면 바로 가고, 안 생기면 비어 있는 채로 넘어간다.
    await page
      .waitForFunction(() => (document.querySelector("#storybook-root")?.childElementCount ?? 0) > 0, null, {
        timeout: 5000,
      })
      .catch(() => {});
    // 메뉴·커맨드 팔레트·다이얼로그는 `#storybook-root` 바깥(body 직속 포털)에 그려진다.
    // 루트만 뜨면 빈 껍데기가 나오므로, 포털이 보이면 body 를 통째로 뜬다.
    const portal = await page.evaluate(() => {
      const root = document.querySelector("#storybook-root");
      return [...document.body.children].some(
        (el) => !el.contains(root) && el !== root && el.getBoundingClientRect().height > 0,
      );
    });
    if (stage) {
      await page.addStyleTag({
        content:
          `body{margin:0!important;padding:0!important}` +
          `#storybook-root{display:inline-block!important;padding:0!important;margin:0!important}` +
          `#storybook-root>div{width:${stage.w}px!important;height:${stage.h}px!important}`,
      });
      await page.waitForTimeout(300);
    }
    // 스토리북의 여백을 걷고 내용 크기로 줄인다 — 안 그러면 모든 컴포넌트가 뷰포트 폭이 된다.
    if (!full && !portal && !stage) {
      await page.addStyleTag({
        content:
          "body{margin:0!important;padding:0!important}" +
          "#storybook-root{display:inline-block!important;padding:0!important;margin:0!important}",
      });
    }
    // html-figma 는 `rect.width < 1 || rect.height < 1` 인 요소를 통째로 버린다(element-to-figma.js).
    // 포털 컨테이너는 크기가 0인 빈 div 라, 그 안에 뜬 메뉴·팔레트가 자식째 사라진다.
    // 안의 내용물은 fixed/absolute 라 컨테이너에 최소 크기를 줘도 배치가 흔들리지 않는다.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("#storybook-root *")) {
        const r = el.getBoundingClientRect();
        if (el.childElementCount > 0 && (r.width < 1 || r.height < 1)) {
          el.style.minWidth = "1px";
          el.style.minHeight = "1px";
        }
      }
    });
    await page.waitForTimeout(400); // 폰트·아이콘이 자리를 잡을 틈
    // 테마는 **마운트 뒤에** 건다. Shell 은 자기 안에서 Primer ThemeProvider 를 세워
    // `data-color-mode` 를 다시 쓰므로, goto 직후에 걸면 그 래퍼가 아직 없어 라이트로 남는다.
    await page.evaluate(
      ({ force, mode }) => {
        const targets = [document.documentElement, document.body];
        if (force) targets.push(...document.querySelectorAll("[data-color-mode]"));
        for (const el of targets) {
          el.dataset.colorMode = mode;
          el.dataset.darkTheme = "dark";
          el.dataset.lightTheme = "light";
        }
      },
      { force: forceDark || forceLight, mode: forceLight ? "light" : "dark" },
    );
    // 물려받을 색을 깔아 준다. `reset.css`·`globals.css` 어디에도 `body { color }` 가 없어서,
    // 자기 CSS 에 `color` 를 안 적은 요소는 브라우저 기본값인 **검정**으로 계산된다 —
    // 글자만이 아니라 아이콘도 그렇다(SVG 의 `fill: currentColor` 가 그 색을 따라간다).
    // 선택자가 `html, body` 라 특이도가 가장 낮으니, 스스로 색을 정한 컴포넌트는 그대로 이긴다.
    // `svg { fill }` 은 `color` 와 별개 속성이라 따로 깔아야 한다 — 기본값이 검정이다.
    await page.addStyleTag({ content: "html,body{color:var(--fgColor-default)}svg{fill:currentColor}" });
    await page.waitForTimeout(100);
    await page.waitForTimeout(150);
    await page.addScriptTag({ content: bundle });
    const { layers, box } = await page.evaluate((portal) => {
      const root = portal ? document.body : document.querySelector("#storybook-root");
      const r = root.getBoundingClientRect();
      const tree = window.htmlToFigma(root);
      /** html-figma 는 이름을 비워 둔다. `ref`(DOM 요소)가 남아 있는 동안 읽어 붙인다 —
       *  이름 없는 레이어 수백 개는 Figma 에서 손댈 수 없다. */
      const label = (el) => {
        if (!(el instanceof Element)) return null;
        const dc = el.getAttribute("data-component");
        if (dc) return dc;
        const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)[0];
        const tag = el.tagName.toLowerCase();
        if (tag === "svg" || tag === "img") return "icon";
        return cls ? `${tag}.${cls.split("_")[0]}` : tag;
      };
      const name = (n) => {
        if (n.ref) {
          const l = label(n.ref);
          if (l) n.name = n.name ?? l;
        }
        delete n.ref;
        for (const k of ["before", "after", "borders", "textValue"]) if (n[k]) name(n[k]);
        for (const c of n.children ?? []) name(c);
        return n;
      };
      name(tree);
      return { layers: tree, box: { width: r.width, height: r.height } };
    }, portal);
    await writeFile(path.join(OUT, `${id}.json`), JSON.stringify(layers));
    const count = (n) => 1 + (n.children ?? []).reduce((a, c) => a + count(c), 0);
    results.push({ id, w: Math.round(box.width), h: Math.round(box.height), layers: count(layers), portal });
    console.log(
      `${id}  ${Math.round(box.width)}x${Math.round(box.height)}  ${count(layers)} 레이어${portal ? "  (포털)" : ""}`,
    );
  } catch (err) {
    failed.push({ id, reason: String(err).split("\n")[0] });
    console.log(`${id}  ★ 실패 — ${String(err).split("\n")[0]}`);
  }
}
if (failed.length > 0) console.log(`실패 ${failed.length}건`);

await browser.close();
server.close();
const idxPath = path.join(OUT, "_index.json");
const prev = existsSync(idxPath) ? JSON.parse(await readFile(idxPath, "utf8")) : [];
const merged = [...prev.filter((r) => !results.some((n) => n.id === r.id)), ...results];
merged.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(idxPath, JSON.stringify(merged, null, 1));
console.log(`누적 ${merged.length}개`);
