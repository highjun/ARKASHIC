import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../src");

/** `src` 아래 모든 파일 경로를 준다(폴더는 빼고). */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const FILES = walk(SRC).map((file) => path.relative(SRC, file));

/**
 * 컴포넌트 폴더 하나 — `<Name>/<Name>.tsx`가 있는 자리다. 부품 파일(`Header.tsx` 등)은 폴더
 * 이름과 달라 여기 걸리지 않는다.
 */
const COMPONENT = /(?:^|\/)(?:shared\/component|[^/]+\/component)\/(?<name>[A-Z][A-Za-z0-9]*)\/\k<name>\.tsx$/u;

/**
 * 규약이 파일 시스템에 대해 말하는 것을 본다 — 린트는 구문을 보고, 이건 "옆에 파일이 있나"라서
 * 테스트가 맞는 자리다(→ ADR 0010).
 */
describe("컴포넌트 폴더 구조", () => {
  const components = FILES.filter((file) => COMPONENT.test(file));

  it("컴포넌트를 하나라도 찾는다 — 정규식이 낡으면 이 테스트가 조용히 비어 버린다", () => {
    expect(components.length).toBeGreaterThan(0);
  });

  it("컴포넌트마다 스토리가 있다", () => {
    const missing = components.filter((file) => !FILES.includes(file.replace(/\.tsx$/u, ".stories.tsx")));

    expect(missing).toEqual([]);
  });

  it("컴포넌트마다 테스트가 있다", () => {
    const missing = components.filter((file) => !FILES.includes(file.replace(/\.tsx$/u, ".test.tsx")));

    expect(missing).toEqual([]);
  });

  it("컴포넌트마다 배럴이 있다 — 밖에서 부르는 자리는 `index.ts` 하나다", () => {
    const missing = components.filter((file) => !FILES.includes(path.join(path.dirname(file), "index.ts")));

    expect(missing).toEqual([]);
  });

  it("`component/` 바로 아래 폴더는 PascalCase이고 같은 이름의 `.tsx`를 갖는다", () => {
    const folders = new Set(
      FILES.filter((file) => /(?:^|\/)component\//u.test(file)).map((file) => {
        const after = file.split("component/")[1] ?? "";
        return `${file.slice(0, file.length - after.length)}${after.split("/")[0] ?? ""}`;
      }),
    );
    const wrong = [...folders].filter((folder) => {
      const name = folder.split("/").at(-1) ?? "";
      return !/^[A-Z][A-Za-z0-9]*$/u.test(name) || !FILES.includes(`${folder}/${name}.tsx`);
    });

    expect(wrong).toEqual([]);
  });

  it("컴포넌트 폴더 밖에는 `component/` 배럴이 없다 — 경로로 가져온다(→ ADR 0008)", () => {
    const groupBarrels = FILES.filter((file) => /(?:^|\/)components?\/index\.ts$/u.test(file));

    expect(groupBarrels).toEqual([]);
  });
});
