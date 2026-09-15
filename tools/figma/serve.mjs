/**
 * 보드 JSON과 임포터를 Figma 플러그인이 내려받을 수 있게 연다.
 *
 * Figma 플러그인의 `fetch`는 **CORS를 본다**. `python3 -m http.server`로는 연결이 닿아도
 * "Failed to fetch"가 난다 — 헤더가 없어서다. 그래서 이 한 장을 둔다.
 * 포트는 매니페스트가 허용하는 `9223`–`9232` 안이어야 하고, SSH 터널이 그 포트를 날라야 한다.
 *
 * 자리가 둘이라 마운트도 둘이다 — 산출물은 `.output/figma/`, 스크립트는 `tools/figma/`에 산다.
 *   `/board-dark-agent.json` → `.output/figma/board-dark-agent.json`
 *   `/tool/importer.js`      → `tools/figma/importer.js`
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { HERE, OUT } from "./paths.mjs";

const PORT = Number(process.argv[2] ?? 9230);
const MOUNTS = [
  { prefix: "/tool/", root: HERE },
  { prefix: "/", root: OUT },
];

const server = createServer(async (req, res) => {
  const head = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,OPTIONS",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, head).end();
    return;
  }
  const name = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (name === "/health") {
    res.writeHead(200, { ...head, "content-type": "application/json" }).end('{"ok":true}');
    return;
  }

  const mount = MOUNTS.find((m) => name.startsWith(m.prefix));
  const file = path.join(mount.root, name.slice(mount.prefix.length - 1));
  // 마운트 밖으로 못 나가게 막는다 — 열어 둔 포트다.
  if (!file.startsWith(mount.root)) {
    res.writeHead(403, head).end();
    return;
  }
  try {
    const s = await stat(file);
    if (!s.isFile()) throw new Error("파일이 아니다");
    res.writeHead(200, { ...head, "content-type": "application/json", "content-length": s.size });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, head).end();
  }
});
server.listen(PORT, "127.0.0.1", () => {
  for (const m of MOUNTS) console.log(`${m.prefix} → ${m.root}`);
  console.log(`http://127.0.0.1:${PORT}`);
});
