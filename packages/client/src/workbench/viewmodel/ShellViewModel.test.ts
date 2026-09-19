import { URI } from "#contracts";
import { CommandService } from "#core/commands";
import { Emitter } from "#core/events";
import { Registry } from "#core/registry";
import { describe, expect, it } from "vitest";
import type { BottomDescriptor } from "../model/IBottomDescriptor";
import type { SidebarDescriptor } from "../model/ISidebarDescriptor";
import type { IStorage } from "../model/IStorage";
import type { IViewport } from "../model/IViewport";
import { ColorMode } from "../model/ColorMode";
import { TabLayout } from "../model/TabLayout";
import { ROOT_PANE_ID } from "../model/tabsShare";
import { ShellViewModel } from "./ShellViewModel";

const fakeStorage = (): IStorage => {
  const store = new Map<string, string>();
  return { get: (key) => store.get(key) ?? null, set: (key, value) => void store.set(key, value) };
};

/** 플랫폼이 주는 값 — 테스트가 직접 넓혔다 좁혔다 한다. */
const fakeViewport = (): IViewport & { setNarrow(value: boolean): void } => {
  const changed = new Emitter();
  let narrow = false;
  return {
    get isNarrow() {
      return narrow;
    },
    onDidChange: (listener) => changed.event(listener),
    setNarrow: (value) => {
      narrow = value;
      changed.fire();
    },
  };
};

const NOOP_CONTENT = () => null;

/** 사이드바 둘(탐색기·검색)과 아래 창 하나(터미널)를 등록한 진짜 레지스트리로 조립한다. */
const make = () => {
  const sidebars = new Registry<SidebarDescriptor>();
  sidebars.add({
    id: "explorer",
    title: "탐색기",
    iconId: "files",
    Content: NOOP_CONTENT,
    actions: [{ actionId: "filesystem.newFile", iconId: "file" }],
  });
  sidebars.add({ id: "search", title: "검색", iconId: "search", Content: NOOP_CONTENT });
  const bottoms = new Registry<BottomDescriptor>();
  bottoms.add({ id: "terminal", title: "터미널", iconId: "bell", Content: NOOP_CONTENT });
  const commands = new CommandService({
    overridesStore: { load: () => ({}), save: () => undefined },
    reportError: () => undefined,
  });
  commands.actions.add({ id: "filesystem.newFile", label: "새 파일", execute: () => undefined });
  const opened: unknown[] = [];
  commands.actions.add({ id: "arka.workbench.open", label: "열기", execute: (context) => void opened.push(context) });
  const storage = fakeStorage();
  const colorMode = new ColorMode({ storage });
  const viewport = fakeViewport();
  const tabLayout = new TabLayout({ storage });
  const viewModel = new ShellViewModel({ sidebars, bottoms, colorMode, viewport, tabLayout, commands });
  return { viewModel, commands, colorMode, viewport, tabLayout, opened };
};

const activeIds = (viewModel: ShellViewModel): string[] =>
  viewModel.sidebars.filter((sidebar) => sidebar.isActive).map((sidebar) => sidebar.id);

describe("IShellViewModel — 사이드바", () => {
  it("레지스트리 순서대로 내고, 첫 사이드바가 처음부터 활성이다", () => {
    const { viewModel } = make();

    expect(viewModel.sidebars.map((sidebar) => sidebar.id)).toEqual(["explorer", "search"]);
    expect(activeIds(viewModel)).toEqual(["explorer"]);
    expect(viewModel.activeSidebar?.title).toBe("탐색기");
  });

  it("활성 사이드바의 액션은 명령의 라벨을 단다", () => {
    const { viewModel } = make();

    expect(viewModel.activeSidebar?.actions).toEqual([
      { actionId: "filesystem.newFile", iconId: "file", label: "새 파일" },
    ]);
  });

  it("같은 것을 다시 고르면 닫힌다 — 폰에서 사이드바를 접는 유일한 수단이다", () => {
    const { viewModel } = make();

    viewModel.toggleSidebar("explorer");
    expect(activeIds(viewModel)).toEqual([]);
    expect(viewModel.activeSidebar).toBeNull();

    viewModel.toggleSidebar("search");
    expect(activeIds(viewModel)).toEqual(["search"]);
  });

  it("모르는 id는 무시한다", () => {
    const { viewModel } = make();

    viewModel.toggleSidebar("없는활동");
    viewModel.revealSidebar("없는활동");

    expect(activeIds(viewModel)).toEqual(["explorer"]);
  });

  it("revealSidebar는 이미 열려 있어도 닫지 않고 드로어를 연다", () => {
    const { viewModel } = make();

    viewModel.revealSidebar("explorer");
    viewModel.revealSidebar("explorer");

    expect(activeIds(viewModel)).toEqual(["explorer"]);
    expect(viewModel.isSidebarOpen).toBe(true);
  });

  it("arka.workbench.revealSidebar 명령이 id로 연다 — 확장의 `<title> 보기`가 이것을 부른다", () => {
    const { viewModel, commands } = make();

    commands.execute("arka.workbench.revealSidebar", { id: "search" });
    commands.execute("arka.workbench.revealSidebar", "엉뚱한 것");

    expect(activeIds(viewModel)).toEqual(["search"]);
    expect(viewModel.isSidebarOpen).toBe(true);
  });
});

describe("IShellViewModel — 아래 창", () => {
  it("처음에는 닫혀 있고, 고르면 열리고, 다시 고르면 닫힌다", () => {
    const { viewModel } = make();
    expect(viewModel.bottoms).toEqual([{ id: "terminal", title: "터미널", iconId: "bell", isActive: false }]);
    expect(viewModel.activeBottom).toBeNull();

    viewModel.toggleBottom("terminal");
    expect(viewModel.activeBottom?.id).toBe("terminal");

    viewModel.toggleBottom("terminal");
    expect(viewModel.activeBottom).toBeNull();
  });
});

describe("IShellViewModel — 밝기와 화면 폭", () => {
  it("colorMode는 Model을 따르고 toggleColorMode가 뒤집는다 — ctrl+j 명령도 같다", () => {
    const { viewModel, colorMode, commands } = make();
    expect(viewModel.colorMode).toBe(colorMode.mode);

    viewModel.toggleColorMode();
    expect(viewModel.colorMode).toBe("dark");

    commands.execute("shell.toggleTheme");
    expect(viewModel.colorMode).toBe("light");
  });

  it("isNarrow는 플랫폼이 주는 값을 따라 바뀐다", () => {
    const { viewModel, viewport } = make();
    expect(viewModel.isNarrow).toBe(false);

    viewport.setNarrow(true);

    expect(viewModel.isNarrow).toBe(true);
  });
});

describe("IShellViewModel — 모바일 드로어", () => {
  it("처음에는 닫혀 있고 직접 열고 닫을 수 있다", () => {
    const { viewModel } = make();
    expect(viewModel.isSidebarOpen).toBe(false);

    viewModel.setSidebarOpen(true);
    expect(viewModel.isSidebarOpen).toBe(true);
    viewModel.setSidebarOpen(false);
    expect(viewModel.isSidebarOpen).toBe(false);
  });

  it("보던 탭이 바뀌면 닫힌다 — 폰에서 드로어가 방금 연 파일을 가린다", () => {
    const { viewModel, tabLayout } = make();
    viewModel.setSidebarOpen(true);

    tabLayout.setTree({
      kind: "leaf",
      id: ROOT_PANE_ID,
      tabs: [{ id: "a", kind: "file", uri: URI.file("a"), title: "a" }],
      activeTabId: "a",
    });

    expect(viewModel.isSidebarOpen).toBe(false);
  });

  it("사이드바를 고르는 것은 닫지 않는다 — 활동 선택은 패널 안에서 하는 일이다", () => {
    const { viewModel } = make();
    viewModel.setSidebarOpen(true);

    viewModel.toggleSidebar("explorer");
    viewModel.toggleSidebar("explorer");

    expect(viewModel.isSidebarOpen).toBe(true);
  });
});

describe("IShellViewModel — 설정 탭 명령", () => {
  it("단축키 명령도 설정을 연다 — 제 화면이 없고 설정 안의 한 범주다", () => {
    const { commands, opened } = make();

    commands.execute("shell.openSettings");
    commands.execute("shell.openKeybindings");

    expect(opened).toEqual([{ uri: URI.parse("arka:///settings") }, { uri: URI.parse("arka:///settings") }]);
  });
});

describe("수명", () => {
  it("dispose 뒤에는 Model 변화를 더 듣지 않는다", () => {
    const { viewModel, viewport } = make();
    viewModel.dispose();

    viewport.setNarrow(true);

    expect(viewModel.isNarrow).toBe(false);
  });
});
