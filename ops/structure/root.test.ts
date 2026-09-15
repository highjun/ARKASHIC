import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./repo.ts";

/**
 * **루트에 있는 것마다 왜 전역인지를 적는다**(→ [ADR 0002](../../docs/adr/0002-live-next-to-what-they-govern.md)).
 *
 * 목록이 아니라 **사유표**를 잠근다. 항목을 늘리려면 사유를 써야 하고, 그 문장이 diff에 뜨는 것이
 * 이 장치의 값이다 — 승인을 막는 것이 아니라 눈에 띄게 만든다. 실재 집합과 양방향으로 대조하니
 * 지워진 것도 잡힌다.
 *
 * **내용은 잠그지 않는다.** `package.json` 해시를 잠그면 의존성 범프마다 빨간불이 뜨고, 사람이
 * 빨간불에 익숙해지는 것이 더 나쁘다.
 */
const REASONS: Readonly<Record<string, string>> = {
  ".devcontainer": "Codespaces가 읽는 자리가 루트 하나로 정해져 있다.",
  ".github": "GitHub가 읽는 자리가 루트 하나로 정해져 있다 — 워크플로·CODEOWNERS·dependabot.",
  ".gitignore": "git이 읽는 자리가 루트다. 패키지마다 두면 무엇이 무시되는지 흩어진다.",
  ".prettierignore": "prettier가 읽는 자리가 실행 cwd(루트)다. 설정 본문은 `ops/prettier.config.ts`에 있다.",
  "CLAUDE.md": "에이전트가 시작할 때 읽는 자리가 루트 하나로 정해져 있다.",
  LICENSE: "저장소 하나에 라이선스 하나다. GitHub가 루트에서 찾는다.",
  "README.md": "저장소를 처음 여는 사람이 보는 자리가 루트다.",
  "SECURITY.md": "GitHub 보안 정책 탭이 루트에서 찾는다.",
  docs: "패키지 하나가 아니라 저장소 전체의 결정과 규약이다.",
  "eslint.config.ts":
    "루트 파일들(`package.json`·`tsconfig.json`·`.github/**`)을 검사한다. 패키지는 각자 자기 설정을 갖는다.",
  ops: "세 패키지를 함께 다스리는 명령과 설정 — 파이프라인·린트·배포·백업·태스크.",
  "package.json": "워크스페이스 루트 선언과 전역 명령. pnpm이 루트에서 찾는다.",
  packages: "배포 단위가 되는 코드. 그 밖은 배치·설정·결정이다.",
  "pnpm-lock.yaml": "워크스페이스 전체가 잠기는 자리가 하나다. pnpm이 루트에서 찾는다.",
  "pnpm-workspace.yaml": "어디가 패키지인지와 catalog를 선언한다. pnpm이 루트에서 찾는다.",
  tools:
    "배포되지 않는 개발 도구. `ops`가 세 패키지를 **함께** 다스리는 것이라면 여기는 한 가지 일만 하는 것들이다 — 지금은 스토리북 렌더를 Figma로 옮기는 파이프라인 하나. `ops`에 넣지 않은 이유는 그 패키지의 typecheck·lint가 플러그인 샌드박스에서 도는 코드(`figma` 전역)까지 덮게 되어서다.",
  "tsconfig.json": "세 패키지가 `extends`하는 바탕. 한 곳에서 정하지 않으면 옵션이 갈린다.",
};

/**
 * 루트에 실재하는 것. `.git`과 git이 무시하는 것을 뺀다. **파일 시스템을 읽는다** —
 * `git ls-tree`로 하면 커밋 전에 더해진 것이 안 잡힌다.
 */
const actual = (): readonly string[] =>
  readdirSync(REPO_ROOT)
    .filter((entry) => entry !== ".git")
    .filter((entry) => spawnSync("git", ["check-ignore", "-q", entry], { cwd: REPO_ROOT }).status !== 0)
    .sort();

describe("루트 항목", () => {
  it("실재하는 것에 사유가 있다 — 없으면 사유를 적고 승인받는다", () => {
    expect(actual().filter((entry) => REASONS[entry] === undefined)).toEqual([]);
  });

  it("사유표에 없는 것이 남아 있지 않다 — 지워진 항목도 잡는다", () => {
    const present = new Set(actual());

    expect(Object.keys(REASONS).filter((entry) => !present.has(entry))).toEqual([]);
  });

  it("사유가 빈 문장이 아니다", () => {
    expect(Object.entries(REASONS).filter(([, reason]) => reason.trim().length < 10)).toEqual([]);
  });
});
