import type { Container } from "#core/di";
import type { ExtensionModule } from "#core/extensions";
import { ContainerProvider } from "#core/viewmodel";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IWorkspaceFiles } from "../extensions/filesystem";
import { MockWorkspaceFiles } from "../extensions/filesystem/model/MockWorkspaceFiles";
import { RootView } from "./view/RootView";
import { createApplication } from "./registerServices";

/**
 * 조립이 실제로 맞물리는지만 본다 — 화면의 내용은 각 컴포넌트가, 계층의 규칙은 각 계층의
 * unit test가 이미 본다. 여기서 걸리는 것은 **배선이 틀린 경우**뿐이다.
 *
 * `<RootView />`를 마운트한다 — main.tsx가 그리는 것과 같은 트리다. beforeunload 가드·전역
 * 키다운·오류 핸들러 등 앱 전체 배선이 `infra/`의 기여들에 있다.
 *
 * 파일시스템 구현만 `MockWorkspaceFiles`로 대신한다. 진짜 구현을 그대로 두면 이 테스트가 서버를
 * 요구하게 된다. Mock이 실물처럼 구는 것은 `workspaceFiles.contract.ts`가 보증한다.
 */

/**
 * `createApplication()`이 실제 저장소(→ `localStorage`)를 쓴다 — 매 테스트가 새 컨테이너를
 * 만들어도 jsdom의 `localStorage`는 파일 전체가 공유한다. 안 지우면 앞 테스트가 연 탭이
 * 다음 테스트에서 부팅 시 복원돼 같은 텍스트가 사이드바와 탭 양쪽에 뜬다.
 *
 * 대역은 **모듈로 끼운다** — 활성화가 곧 만드는 것이라 컨테이너를 돌려준 뒤에는 늦다. 같은 id를 다시 물리면
 * 나중 것이 이긴다.
 */

describe("registerServices", () => {
  /** 테스트마다 만든 컨테이너. 앱은 하나뿐이라 실제로는 페이지가 닫힐 때까지 살지만, 여기서는 다음 테스트에
   *  전역 리스너(beforeunload·keydown)가 새지 않게 끝에 dispose한다. */
  const containers: Container[] = [];
  const track = (container: Container): Container => {
    containers.push(container);
    return container;
  };

  afterEach(() => {
    for (const container of containers.splice(0)) container.dispose();
    localStorage.clear();
  });

  /** 파일시스템을 대역으로 가린다 — 진짜 구현을 그대로 두면 이 테스트가 서버를 요구한다. */
  const mocks = (workspaceFiles: IWorkspaceFiles): ExtensionModule => ({
    id: "test.mocks",
    provides: [{ id: "arka.filesystem.workspaceFiles", lifetime: "singleton", create: () => workspaceFiles }],
  });

  const mountWith = (workspaceFiles: IWorkspaceFiles) => {
    const container = track(createApplication([mocks(workspaceFiles)]));
    render(
      <ContainerProvider container={container}>
        <RootView />
      </ContainerProvider>,
    );
    return container;
  };

  it("셸에 탐색기 활동이 있다", () => {
    mountWith(new MockWorkspaceFiles({ projects: null }));

    expect(screen.getByLabelText("탐색기")).toBeDefined();
  });

  describe("알림 종", () => {
    it("온 것이 없으면 종에 수가 안 붙는다", () => {
      mountWith(new MockWorkspaceFiles({}));

      expect(screen.getByLabelText("알림 없음")).toBeDefined();
    });

    it("알림이 오면 종에 수가 붙고, 골라서 닫으면 사라진다", async () => {
      const container = mountWith(new MockWorkspaceFiles({}));
      act(() => {
        container.resolve("arka.workbench.notifications").notify("error", "터졌다");
      });

      // Radix 의 드롭다운은 click 이 아니라 pointerdown 에 열린다(왼쪽 버튼만).
      fireEvent.pointerDown(await screen.findByLabelText("알림 1건"), { button: 0, ctrlKey: false });
      fireEvent.click(await screen.findByRole("menuitem", { name: /터졌다/u }));

      expect(await screen.findByLabelText("알림 없음")).toBeDefined();
    });
  });

  /**
   * jsdom은 CSS를 적용하지 않으므로 트리가 화면 밖으로 밀려 있어도 여기서는 통과한다 —
   * 보이는지가 아니라 **배선이 닿는지**만 보는 테스트다.
   */
  it("워크스페이스 트리가 사이드바까지 연결된다", async () => {
    mountWith(new MockWorkspaceFiles({ projects: null }));

    expect(await screen.findByText("projects")).toBeDefined();
  });

  /**
   * **저장 안 된 변경이 Shell까지 실제로 닿는지**를 본다 — 텍스트 탭 provider가 돌려준 descriptor의 `isDirty`가
   * 탭 컨테이너 안의 `FileContentView`가 편집하는 것과 같은 `fileContentViewModel`을 읽는지가 이 배선의 전부다.
   * 하나라도 다른 인스턴스를 가리키면 dirty가 조용히 `false`로 굳는다.
   *
   * `editFile`을 직접 부르는 것은 CodeMirror 타이핑을 jsdom이 흉내내지 못해서다.
   */
  describe("저장 안 된 변경 보호", () => {
    const mountWithOpenFile = async () => {
      const container = mountWith(new MockWorkspaceFiles({ "a.md": "원본" }));

      // 탐색기는 이미 기본 활동이다 — 다시 누르면 "같은 것을 또 골랐다"로 읽어 오히려 닫는다.
      fireEvent.click(await screen.findByText("a.md"));
      // 저장 버튼은 readOnly가 풀렸을 때만 뜬다 — 즉 파일이 다 읽혔다는 신호다. 그전에
      // editFile을 부르면 Model이 조용히 무시한다.
      await screen.findByRole("button", { name: "저장" });

      return container.resolve("arka.filesystem.fileContentViewModel");
    };

    it("탭에 저장 안 됨 표시가 뜬다", async () => {
      const fileContentViewModel = await mountWithOpenFile();
      const tab = screen.getByRole("tab", { name: /a\.md/u });

      expect(tab.hasAttribute("data-dirty")).toBe(false);
      act(() => fileContentViewModel.editFile("a.md", "고친 내용"));

      expect(tab.hasAttribute("data-dirty")).toBe(true);
    });

    it("닫으려 하면 확인을 구하고, 취소하면 탭이 남는다", async () => {
      const fileContentViewModel = await mountWithOpenFile();
      act(() => fileContentViewModel.editFile("a.md", "고친 내용"));

      fireEvent.click(screen.getByRole("button", { name: "a.md 닫기" }));
      expect(await screen.findByText("저장하지 않은 변경사항이 있다")).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "취소" }));

      expect(screen.getByRole("tab", { name: /a\.md/u })).toBeDefined();
    });

    it("확인하면 실제로 닫힌다", async () => {
      const fileContentViewModel = await mountWithOpenFile();
      act(() => fileContentViewModel.editFile("a.md", "고친 내용"));

      fireEvent.click(screen.getByRole("button", { name: "a.md 닫기" }));
      fireEvent.click(await screen.findByRole("button", { name: "닫기" }));

      expect(screen.queryByRole("tab", { name: /a\.md/u })).toBeNull();
    });

    it("저장 안 된 파일이 있으면 beforeunload를 막는다", async () => {
      const fileContentViewModel = await mountWithOpenFile();
      act(() => fileContentViewModel.editFile("a.md", "고친 내용"));

      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("저장 안 된 것이 없으면 beforeunload를 막지 않는다", async () => {
      await mountWithOpenFile();

      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });

  /**
   * 화면이 죽어도 아무도 모르는 상태를 막는 배선이 실제로 닿는지 본다 — 탭 하나가 렌더 중 던지면
   * 빈 화면 대신 오류 띠가 뜨고, `IErrorLog`에 기록이 남아야 한다.
   */
  describe("렌더 오류 보호", () => {
    it("탭이 렌더 중 던지면 오류 띠가 뜨고 IErrorLog에 남는다", async () => {
      // React가 잡힌 오류를 console.error로도 내보낸다 — 테스트 출력이 그걸로 덮이지 않게 막는다.
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const container = track(createApplication([mocks(new MockWorkspaceFiles({ "a.md": "" }))]));
      // 무엇이든 먼저 받아 터지는 본문을 돌려주는 provider를 얹는다 — 텍스트 provider보다 먼저 묻는다.
      container.resolve("arka.workbench.tabSystem").add({
        id: "test.crashing",
        priority: 1000,
        openTab: () =>
          Promise.resolve({
            icon: null,
            title: "터지는 탭",
            isDirty: false,
            Content: () => {
              throw new Error("탭이 터졌다");
            },
          }),
      });
      render(
        <ContainerProvider container={container}>
          <RootView />
        </ContainerProvider>,
      );

      fireEvent.click(await screen.findByText("a.md"));

      expect(await screen.findByRole("alert")).toHaveTextContent("탭이 터졌다");
      expect(
        container.resolve("arka.workbench.errorLog").entries.map((entry) => [entry.source, entry.message]),
      ).toEqual([["render", "탭이 터졌다"]]);
      consoleError.mockRestore();
    });
  });

  describe("커맨드와 단축키", () => {
    it("키보드 단축키 커맨드가 설정 탭을 열고 거기 단축키 표가 있다", async () => {
      mountWith(new MockWorkspaceFiles({}));
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      fireEvent.click(await screen.findByText("키보드 단축키 보기"));
      expect(await screen.findByRole("tab", { name: /설정/u })).toBeDefined();
      expect(await screen.findByRole("heading", { name: "단축키" })).toBeDefined();
      expect(screen.getByText("shell.openCommandPalette")).toBeDefined();
    });
  });

  describe("설정 배선", () => {
    it("설정 탭에서 밀도를 바꾸면 html의 data-density가 따라온다", async () => {
      mountWith(new MockWorkspaceFiles({}));
      fireEvent.keyDown(window, { key: ",", ctrlKey: true });
      expect(await screen.findByRole("tab", { name: /설정/u })).toBeDefined();
      expect(document.documentElement.dataset["density"]).toBe("compact");
      fireEvent.click(screen.getByLabelText("touch"));
      expect(document.documentElement.dataset["density"]).toBe("touch");
      expect(localStorage.getItem("workbench.settings")).toContain("touch");
    });
  });

  describe("부팅", () => {
    it("셸 모듈과 확장이 기여 지점을 채운다 — 사이드바 하나, 탭 provider 둘, 밀도 설정, 명령", () => {
      const container = track(createApplication([mocks(new MockWorkspaceFiles({}))]));

      expect(
        container
          .resolve("arka.workbench.sidebar")
          .list()
          .map((sidebar) => sidebar.id),
      ).toEqual(["explorer"]);
      expect(
        container
          .resolve("arka.workbench.tabSystem")
          .list()
          .map((provider) => provider.id)
          .sort(),
      ).toEqual(["arka.filesystem.text", "arka.workbench.settings"]);
      expect(
        container
          .resolve("arka.settings")
          .schema.list()
          .map((setting) => setting.id),
      ).toEqual(["workbench.density"]);
      const commands = container.resolve("arka.commands");
      for (const id of ["arka.workbench.open", "arka.filesystem.focus"])
        expect(commands.actions.tryGet(id), id).toBeDefined();
    });

    it("켜지 못한 확장은 알림으로 남고 나머지는 켜진다", () => {
      const broken: ExtensionModule = {
        id: "test.broken",
        activate: () => {
          throw new Error("고장");
        },
      };
      const container = track(createApplication([mocks(new MockWorkspaceFiles({})), broken]));

      expect(container.resolve("arka.workbench.notifications").items.map((item) => item.message)).toEqual([
        "확장 test.broken을(를) 켜지 못했다(activate) — 고장",
      ]);
      expect(container.resolve("arka.workbench.sidebar").list()).toHaveLength(1);
    });
  });
});
