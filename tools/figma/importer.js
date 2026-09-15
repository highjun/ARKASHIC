/**
 * html-figma LayerNode 트리를 Figma 노드로 짓는다. **플러그인 안에서 돈다** —
 * `figma_execute` 로 한 번 실어 두고 `globalThis.__arka.importFrom(url)` 로 부른다.
 *
 * 브리지의 `import_html_layers` 가 하던 일이다. 남의 minified 번들을 떼어 오는 대신 직접 쓴다 —
 * 우리 트리는 종류가 넷(FRAME·TEXT·RECTANGLE·SVG)뿐이고 속성도 스물여덟이라 그 표면만 다루면
 * 된다. 우리가 만든 JSON이니 앞으로도 우리가 아는 것만 들어온다.
 *
 * 좌표는 **부모 기준 상대값**이다(음수도 나온다) — Figma API 와 같아 그대로 넣는다.
 * 데이터는 `serve.mjs` 가 연 포트에서 `fetch` 로 가져온다. 대화에 싣지 않으므로 크기가 안 걸린다.
 */
globalThis.__arka = globalThis.__arka ?? {};

/** CSS 굵기 → Figma 스타일 이름. 없으면 옆으로 흘린다(Noto Sans KR 엔 SemiBold 가 없다). */
const WEIGHT = {
  100: ["Thin", "Light", "Regular"],
  200: ["ExtraLight", "Light", "Regular"],
  300: ["Light", "Regular"],
  400: ["Regular"],
  500: ["Medium", "Regular"],
  600: ["SemiBold", "Bold", "Medium", "Regular"],
  700: ["Bold", "Medium", "Regular"],
  800: ["ExtraBold", "Bold", "Regular"],
  900: ["Black", "Bold", "Regular"],
};

globalThis.__arka.importTree = async (tree, opts) => {
  const { parentId = null, x = null, y = null, name = null, assetBase = null, background = null } = opts ?? {};
  const stats = { FRAME: 0, TEXT: 0, RECTANGLE: 0, SVG: 0, skipped: 0, droppedImage: 0, asset: 0, widened: 0 };
  const fallback = new Set();

  // 0. 이미지 칠에 걸린 자산을 **미리** 받아 둔다 — 짓는 동안은 동기라 `await` 를 못 쓴다.
  //    추출 때의 URL 은 죽은 임시 서버를 가리키므로 파일 이름만 떼어 우리 서버에서 찾는다.
  const assets = new Map();
  if (assetBase) {
    const names = new Set();
    (function scan(n) {
      for (const p of n.fills ?? []) {
        if (p.type === "IMAGE" && typeof p.url === "string" && p.url.endsWith(".svg"))
          names.add(p.url.split("/").pop());
      }
      for (const c of n.children ?? []) scan(c);
    })(tree);
    for (const file of names) {
      try {
        const r = await fetch(`${assetBase}/${file}`);
        if (r.ok) assets.set(file, await r.text());
      } catch {
        /* 없으면 없는 대로 간다 */
      }
    }
  }

  // 1. 서체를 먼저 다 읽는다. `characters` 를 넣기 전에 로드돼 있어야 한다.
  const wanted = new Map();
  (function scan(n) {
    if (n.type === "TEXT") {
      const family = n.fontFamily || "Inter";
      for (const style of WEIGHT[n.fontWeight ?? 400] ?? ["Regular"])
        wanted.set(family + " " + style, { family, style });
    }
    for (const c of n.children ?? []) scan(c);
  })(tree);
  const ok = new Set();
  for (const f of wanted.values()) {
    try {
      await figma.loadFontAsync(f);
      ok.add(f.family + " " + f.style);
    } catch {
      stats.skipped += 0;
    }
  }
  /** 굵기 후보를 순서대로 훑어 **실제로 있는** 첫 스타일을 고른다. */
  const fontFor = (family, weight) => {
    const chain = WEIGHT[weight ?? 400] ?? ["Regular"];
    for (const style of chain) {
      if (!ok.has(family + " " + style)) continue;
      if (style !== chain[0]) fallback.add(`${family} ${weight} → ${style}`);
      return { family, style };
    }
    return null;
  };

  // 2. 짓는다.
  /**
   * Figma 가 받는 칠만 남긴다.
   *
   * html-figma 는 이미지 칠에 `url` 을 얹어 보내는데 Figma 는 모르는 키를 보면 통째로 거부한다.
   * 게다가 `imageHash` 가 `null` 이라 올릴 그림도 없다(URL 이 추출할 때 띄운 임시 서버를 가리킨다).
   * 그래서 쓸 수 없는 이미지 칠은 **버리고 센다** — 몇 장인지는 알아야 하니까.
   */
  const paints = (arr) =>
    (arr ?? [])
      .filter((p) => {
        if (p.type === "SOLID") return true;
        if (p.type === "IMAGE" && typeof p.imageHash !== "string") {
          stats.droppedImage += 1;
          return false;
        }
        return true;
      })
      .map((p) => {
        if (p.type !== "IMAGE") return p;
        const { url, ...rest } = p;
        return rest;
      });
  const paint = (node, n) => {
    if (Array.isArray(n.fills)) node.fills = paints(n.fills);
    if (Array.isArray(n.strokes) && n.strokes.length) {
      node.strokes = paints(n.strokes);
      if (n.strokeWeight != null) node.strokeWeight = n.strokeWeight;
    }
    if (Array.isArray(n.effects) && n.effects.length) {
      try {
        node.effects = n.effects;
      } catch {
        /* 모양이 안 맞으면 버린다 */
      }
    }
    if (n.opacity != null && n.opacity !== 1) node.opacity = n.opacity;
    for (const k of ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"]) {
      if (n[k] && k in node) node[k] = n[k];
    }
  };
  const place = (node, n) => {
    try {
      node.resize(Math.max(n.width ?? 1, 0.01), Math.max(n.height ?? 1, 0.01));
    } catch {
      /* 빈 텍스트 등 */
    }
    node.x = n.x ?? 0;
    node.y = n.y ?? 0;
  };

  // 만든 노드를 다 적어 둔다. Figma 의 `create*` 는 부모에 붙기 **전까지 페이지에 매달리므로**,
  // 도중에 터지면 반쯤 지은 것이 캔버스에 그대로 남는다(실제로 겪었다 — 잔해 9개).
  const made = [];
  const build = (n) => {
    if (n.type === "SVG") {
      let node;
      try {
        node = figma.createNodeFromSvg(n.svg);
      } catch {
        stats.skipped += 1;
        return null;
      }
      made.push(node);
      node.name = n.name || "svg";
      place(node, n);
      stats.SVG += 1;
      return node; // 안쪽은 Figma 가 만든 벡터다 — 건드리지 않는다
    }
    if (n.type === "TEXT") {
      const font = fontFor(n.fontFamily || "Inter", n.fontWeight);
      if (!font) {
        stats.skipped += 1;
        return null;
      }
      const node = figma.createText();
      made.push(node);
      node.fontName = font;
      if (n.fontSize != null) node.fontSize = Math.max(n.fontSize, 1);
      node.characters = n.characters ?? "";
      node.name = n.name || node.characters.slice(0, 24) || "text";
      for (const k of ["lineHeight", "letterSpacing", "textCase", "textAlignHorizontal"]) {
        if (n[k] == null) continue;
        try {
          node[k] = n[k];
        } catch {
          /* 값이 어긋나면 Figma 기본값으로 둔다 */
        }
      }
      // Figma 엔 Pretendard 가 없어 Noto Sans KR 로 갈아 끼운다. 그쪽이 더 넓어서, 브라우저가 잰
      // 상자에 그대로 못 박으면 한 줄짜리 라벨이 두 줄로 접힌다("Action" → "Act / ion").
      // 한 줄로 보이는 것만 제 너비로 넓힌다 — 여러 줄은 접히는 게 맞다.
      const oneLine = (n.height ?? 0) <= (n.fontSize ?? 12) * 2;
      node.textAutoResize = "WIDTH_AND_HEIGHT";
      const natural = node.width;
      node.textAutoResize = "NONE"; // 상자 크기를 브라우저가 잰 값으로 못 박는다
      place(node, n);
      if (oneLine && natural > node.width + 0.5) {
        const grew = natural - node.width;
        node.resize(natural, node.height);
        // 오른쪽·가운데 정렬은 왼쪽 끝이 기준이 아니다 — 넓힌 만큼 되돌려 놓는다.
        if (n.textAlignHorizontal === "RIGHT") node.x -= grew;
        else if (n.textAlignHorizontal === "CENTER") node.x -= grew / 2;
        stats.widened += 1;
      }
      paint(node, n);
      stats.TEXT += 1;
      return node;
    }
    const isRect = n.type === "RECTANGLE";
    const node = isRect ? figma.createRectangle() : figma.createFrame();
    made.push(node);
    node.name = n.name || n.type.toLowerCase();
    if (!isRect) {
      node.fills = []; // 프레임 기본 흰 채우기를 먼저 지운다
      node.clipsContent = n.clipsContent === true;
    }
    place(node, n);
    paint(node, n);
    stats[isRect ? "RECTANGLE" : "FRAME"] += 1;
    // 못 쓰는 이미지 칠 자리에 받아 둔 SVG 를 끼운다 — 로고가 그 자리다.
    const img = (n.fills ?? []).find((p) => p.type === "IMAGE" && typeof p.url === "string");
    const svg = img && assets.get(img.url.split("/").pop());
    if (svg && !isRect) {
      try {
        const art = figma.createNodeFromSvg(svg);
        made.push(art);
        art.name = "asset";
        art.resize(Math.max(n.width ?? 1, 0.01), Math.max(n.height ?? 1, 0.01));
        art.x = 0;
        art.y = 0;
        node.appendChild(art);
        stats.asset += 1;
      } catch {
        /* 못 읽으면 빈 자리로 둔다 */
      }
    }
    if (!isRect) {
      // 형제 순서는 **앞선 것이 위**다(`retune` 이 그렇게 맞춰 둔다).
      // Figma 는 나중에 붙인 것이 위라 거꾸로 붙인다.
      const kids = n.children ?? [];
      for (let i = kids.length - 1; i >= 0; i -= 1) {
        const kid = build(kids[i]);
        if (kid) node.appendChild(kid);
      }
    }
    return node;
  };

  let root;
  try {
    root = build(tree);
    if (!root) throw new Error("루트를 못 지었다");
  } catch (err) {
    // 반쯤 지은 것을 걷어낸다. 자식은 부모가 지워질 때 같이 가니 `removed` 를 먼저 본다.
    for (let i = made.length - 1; i >= 0; i -= 1) {
      try {
        if (!made[i].removed) made[i].remove();
      } catch {
        /* 이미 사라졌다 */
      }
    }
    throw err;
  }
  if (name) root.name = name;
  // 브라우저의 `<body>` 배경은 트리에 안 실린다. 루트가 비면 내보낸 PNG 가 투명이라
  // 흰 바탕에 합성돼 `#f0f6fc` 같은 밝은 글자가 안 보인다 — 화면 프레임이면 바탕을 깔아 준다.
  if (background && root.type === "FRAME" && (root.fills ?? []).length === 0) {
    const s = background.replace("#", "");
    const ch = (i) => parseInt(s.slice(i, i + 2), 16) / 255;
    root.fills = [{ type: "SOLID", color: { r: ch(0), g: ch(2), b: ch(4) }, opacity: 1 }];
    root.clipsContent = true;
  }
  const parent = parentId ? await figma.getNodeByIdAsync(parentId) : figma.currentPage;
  parent.appendChild(root);
  if (x != null) root.x = x;
  if (y != null) root.y = y;
  return {
    id: root.id,
    name: root.name,
    size: `${Math.round(root.width)}x${Math.round(root.height)}`,
    stats,
    fallback: [...fallback],
  };
};

globalThis.__arka.importFrom = async (url, opts) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return globalThis.__arka.importTree(JSON.parse(await r.text()), opts);
};
