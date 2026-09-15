/**
 * 이 도구들이 읽고 쓰는 자리. `paths.py`와 같은 규약이다.
 *
 * **스크립트는 `tools/figma/`(추적됨)에 살고 산출물은 `.output/`(추적 안 됨)에 남는다.**
 * 파이프라인을 고칠 때마다 이력이 남아야 해서 갈랐다 — 2026-09-15까지는 스크립트도
 * `.output/` 안에 있어서 크게 고쳐도 아무 기록이 없었다.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

export const HERE = import.meta.dirname;
export const REPO = path.resolve(HERE, "..", "..");

/** 보드·토큰 JSON이 나오는 자리. */
export const OUT = path.join(REPO, ".output", "figma");

/** `extract.mjs`가 스토리를 떨어뜨리는 자리. 모드·폼팩터마다 하위 디렉터리가 하나씩 선다. */
export const CLIENT_OUT = path.join(REPO, "packages", "client", ".output", "figma");

/** 스토리북 정적 빌드. `pnpm --filter client build-storybook`이 만든다. */
export const STORYBOOK = path.join(REPO, "packages", "client", ".output", "storybook-static");

/** `OUT` 아래 경로를 만들고 디렉터리를 보장한다. */
export const out = (...parts) => {
  mkdirSync(OUT, { recursive: true });
  return path.join(OUT, ...parts);
};
