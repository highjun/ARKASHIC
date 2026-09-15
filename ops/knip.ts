import type { KnipConfig } from "knip";

/**
 * **죽은 표면을 찾는다** — 안 쓰는 파일·export·의존성, phantom 의존성, 안 쓰는 catalog 항목.
 * 한때 컴포넌트의 29%가 아무도 안 쓰는 채 쌓였고, `index.ts`에 "바깥이 부르는 것만"이라는
 * 규약은 이것 없이는 검사할 수 없다(→ ADR 0011).
 *
 * **진입점 선언이 정확도의 전부다.** 빠뜨리면 거기서 닿는 것이 전부 "안 쓰는 것"으로 뜬다.
 */
const config: KnipConfig = {
  workspaces: {
    // 저장소 루트. 진입점은 루트 설정 하나다 — 나머지는 워크스페이스가 든다.
    ".": {
      entry: ["eslint.config.ts"],
      project: ["*.ts"],
      // **루트 `package.json`은 의존성 없이 둔다**(→ ADR 0001) — 루트 설정을 읽는 것은 `ops`의
      // ESLint 바이너리이고 플러그인도 그쪽에서 풀린다. 루트에 또 선언하면 eslint가 두 벌이 된다.
      ignoreDependencies: ["eslint", "@eslint/json", "eslint-plugin-package-json", "eslint-plugin-yml"],
    },
    "packages/client": {
      // vite의 root가 `src/workbench/`라 진입 HTML이 거기 있다. 스토리·VRT·E2E는 각자 러너가 든다.
      entry: [
        "src/workbench/main.tsx",
        "src/**/*.stories.tsx",
        ".storybook/{main,preview}.ts",
        "test/vrt/run.ts",
        "test/vrt/vrt.config.ts",
        "test/e2e/*.spec.ts",
        // 테스트는 자기 옆의 것을 부른다 — 테스트만 쓰는 export도 "쓰이는 것"이다.
        "src/**/*.test.{ts,tsx}",
        "test/**/*.test.ts",
      ],
      project: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
      // CSS Modules 타입 선언은 참조가 아니라 선언이고, e2e 자료는 테스트가 읽고 쓰는 파일이다.
      ignore: ["src/cssModules.d.ts", "test/e2e/fixture/**"],
    },
    "packages/server": {
      entry: ["src/index.ts", "build.ts", "src/**/*.test.ts", "test/**/*.test.ts"],
      project: ["src/**/*.ts", "test/**/*.ts"],
    },
    "packages/contracts": { entry: ["src/index.ts", "src/**/*.test.ts"], project: ["src/**/*.ts"] },
    /*
     * 손으로 부르는 스크립트 모음이라 **전부가 진입점**이다 — 서로를 부르지도 않는다.
     * `importer.js`는 한술 더 떠 Figma 플러그인 샌드박스에 `fetch`+`eval`로 실리는 코드라
     * 이 저장소 안에 import하는 곳이 영영 없다. `@playwright/test`는 `extract.mjs`가 쓴다.
     */
    "tools/figma": {
      entry: ["*.mjs", "importer.js"],
      project: ["**/*.{mjs,js}"],
    },
    ops: {
      // `ops`는 명령 모음이라 진입점이 여럿이다 — 파이프라인·린트·태스크·배포·훅·백업.
      entry: [
        "pipeline/{check,verify}.ts",
        "lint/run.ts",
        "lint/index.ts",
        "tasks/main.ts",
        "deploy/{build,smoke,anonSmoke}.ts",
        "hooks/prePush.ts",
        "backup/run.ts",
        "structure/*.test.ts",
        "*.config.ts",
        "knip.ts",
        ".markdownlint-cli2.jsonc",
      ],
      project: ["**/*.ts"],
      // 루트 설정이 쓰는 플러그인이 여기 선언돼 있다(위 `"."` 주석) — 이 패키지는 import하지 않는다.
      // `@commitlint/cli`는 CI가 `pnpm --filter ops exec commitlint`로 **바이너리로** 부른다.
      // `@commitlint/cli`·`markdownlint-cli2`는 **바이너리로** 부른다(CI와 `lint/run.ts`) — knip은
      // 헬퍼를 지나는 호출에서 이름을 못 읽는다. `prettier`는 자기 설정 파일로 알아본다.
      ignoreDependencies: ["eslint-plugin-package-json", "eslint-plugin-yml", "@commitlint/cli", "markdownlint-cli2"],
    },
  },
  /*
   * **코드에서 import하지 않는 의존성.** knip이 볼 수 없는 자리에서 쓰인다 — 이유가 없으면
   * 목록에 두지 않는다.
   */
  ignoreDependencies: [
    // CSS `@import`로 들어온다(`src/workbench/globals.css`). knip은 CSS를 파싱하지 않는다.
    "pretendard",
    "@fontsource-variable/cascadia-code",
    // VRT가 스토리북 산출물을 띄우려고 **바이너리로** 부른다(`test/vrt/vrt.config.ts`).
    "http-server",
  ],
};

export default config;
