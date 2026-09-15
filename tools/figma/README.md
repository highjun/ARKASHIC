# Figma 파이프라인

스토리북이 **실제로 렌더한 것**을 Figma 레이어로 뽑아 보드로 조립하고 올린다.
컴포넌트가 `@primer/react` 래퍼라 CSS만 보고 손으로 베끼면 Primer 내부 기하를 놓친다 —
진짜 브라우저에 띄워 계산된 스타일째 직렬화하는 편이 정확하고 싸다.

**스크립트는 여기(추적됨), 산출물은 `.output/`(추적 안 됨)에 남는다.**
2026-09-15까지는 스크립트도 `.output/` 안에 있어서 크게 고쳐도 아무 기록이 없었다.

## 자리

| 무엇 | 어디 |
| --- | --- |
| 스토리 추출물 | `packages/client/.output/figma/stories-<모드>/` |
| 보드·화면·토큰 JSON | `.output/figma/` |
| 스토리북 정적 빌드 | `packages/client/.output/storybook-static/` |

경로는 `paths.mjs`·`paths.py`가 한 곳에서 든다. 스크립트에 절대경로를 적지 않는다.

## 흐름

```sh
pnpm --filter client build-storybook          # 1. 스토리북을 정적으로 굽는다

node extract.mjs $(스토리 id…) --dark --out stories-dark   # 2. 실렌더 → LayerNode
python3 build_boards.py dark                  # 3. 보드로 조립 → .output/figma/board-dark-*.json
node serve.mjs 9230                           # 4. 플러그인이 내려받을 수 있게 연다
```

4번 뒤 Figma에서 Console MCP의 `figma_execute`로:

```js
const src = await (await fetch("http://localhost:9230/tool/importer.js")).text();
(0, eval)(src);
await globalThis.__arka.importFrom("http://localhost:9230/board-dark-agent.json", {
  parentId: 페이지id, x: 1490, y: 0, name: "Components · agent",
  assetBase: "http://localhost:9230/tool/asset", background: "#0d1117",
});
```

## 알아 둘 함정

- **플러그인의 `fetch`는 CORS를 본다.** `python3 -m http.server`로는 연결이 닿아도
  "Failed to fetch"가 난다 — `serve.mjs`가 헤더를 붙이는 이유다.
- 매니페스트가 여는 포트는 `9223`–`9232`뿐이고 **SSH 터널이 그 포트를 날라야** 한다.
- **형제 순서는 앞선 것이 위다.** Figma는 나중에 붙인 것이 위라 `importer.js`가 거꾸로 붙인다.
- **루트에 배경이 없으면 내보낸 PNG가 투명**이라 밝은 글자가 흰 바탕에 묻힌다 — `background` 옵션.
- 이미지 칠의 `url` 키를 Figma가 거부한다. `imageHash`가 `null`이면 버리고, 로고는 `asset/`에서
  SVG로 받아 끼운다.

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `extract.mjs` | 스토리북 실렌더 → html-figma LayerNode JSON |
| `build_boards.py` | 추출물을 그룹별 보드 한 장으로 조립 |
| `build_screens.py` | 셸 슬롯에 진짜 컴포넌트를 끼워 넣은 화면 |
| `build_mobile_*.py` · `figma_kit.py` | 손으로 좌표를 찍은 **설계안** 모바일 화면(실렌더가 아니다) |
| `importer.js` | 플러그인 안에서 LayerNode → Figma 노드 |
| `serve.mjs` | 위 산출물과 이 폴더를 CORS 붙여 연다 |
| `resolve_tokens.mjs` → `plan_variables.mjs` → `emit_payload.mjs` | 코드가 쓰는 CSS 토큰을 3계층 Figma 변수 계획으로 |
| `paths.mjs` · `paths.py` | 읽고 쓰는 자리 |
