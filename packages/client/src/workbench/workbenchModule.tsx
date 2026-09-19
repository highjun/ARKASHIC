import { CommandService } from "#core/commands";
import type { Disposable } from "#core/di";
import type { ExtensionModule } from "#core/extensions";
import { Registry } from "#core/registry";
import { Settings, type ISettings } from "#core/settings";
import { URI } from "#contracts";
import { createDocumentDensity, DENSITY_SETTING_ID } from "./infra/DocumentDensity";
import { createDocumentTheme } from "./infra/DocumentTheme";
import { createErrorNotifier } from "./infra/ErrorNotifier";
import { createGlobalErrorHandlers } from "./infra/GlobalErrorHandlers";
import { createGlobalKeybindings } from "./infra/GlobalKeybindings";
import { createServerInfoPort } from "./infra/HttpServerInfo";
import { createStoragePort } from "./infra/LocalStorage";
import { createUnloadGuard } from "./infra/UnloadGuard";
import { createViewportQuery } from "./infra/ViewportQuery";
import { AppLifetime } from "./model/AppLifetime";
import { ColorMode } from "./model/ColorMode";
import { ErrorLog } from "./model/ErrorLog";
import type { ServerInfo } from "./model/IServerInfo";
import { Notifications } from "./model/Notifications";
import { findLeaf } from "./model/paneTree";
import { TabLayout } from "./model/TabLayout";
import { TabSystem } from "./model/TabSystem";
import { Workspace } from "./model/Workspace";
import { settingsTabProvider } from "./view/settingsTabProvider";
import { AppStatusViewModel } from "./viewmodel/AppStatusViewModel";
import { CommandPaletteViewModel } from "./viewmodel/CommandPaletteViewModel";
import { KeybindingViewModel } from "./viewmodel/KeybindingViewModel";
import { NotificationViewModel } from "./viewmodel/NotificationViewModel";
import { SettingsViewModel } from "./viewmodel/SettingsViewModel";
import { ShellViewModel } from "./viewmodel/ShellViewModel";
import { TabSystemViewModel } from "./viewmodel/TabSystemViewModel";

declare module "#core/di" {
  /**
   * workbench 모듈만 아는 것들 — core 서비스(`arka.settings`)의 등록과, 부팅 때 켜져 앱이 사는 동안 도는 배선
   * 여섯. 배선은 만들어지는 순간 켜지고 컨테이너가 정리할 때 꺼진다.
   */
  interface InstanceMap {
    "arka.settings": ISettings;
    "arka.workbench.globalErrorHandlers": Disposable;
    "arka.workbench.errorNotifier": Disposable;
    "arka.workbench.documentTheme": Disposable;
    "arka.workbench.documentDensity": Disposable;
    "arka.workbench.globalKeybindings": Disposable;
    "arka.workbench.unloadGuard": Disposable;
  }
}

/** 사용자 단축키 재정의가 저장되는 키. */
const KEYBINDING_OVERRIDES_KEY = "workbench.keybindings";
/** 설정 값이 저장되는 키. */
const SETTINGS_KEY = "workbench.settings";

/** `arka.workbench.open`이 받는 것. */
const isOpenContext = (value: unknown): value is { readonly uri: URI; readonly preview?: boolean } =>
  typeof value === "object" && value !== null && "uri" in value && value.uri instanceof URI;
/** `arka.workbench.retargetTabs`가 받는 것 — 워크스페이스 루트 기준 경로 접두어 둘. */
const isRetargetContext = (value: unknown): value is { readonly oldPrefix: string; readonly newPrefix: string } =>
  typeof value === "object" &&
  value !== null &&
  "oldPrefix" in value &&
  typeof value.oldPrefix === "string" &&
  "newPrefix" in value &&
  typeof value.newPrefix === "string";

/**
 * 셸 자신을 켜는 모듈 — 확장과 같은 모양이다. 먼저 켜진다(배럴 순서).
 *
 * **전부 singleton이다.** 탭마다 자식 컨테이너가 생기므로 scoped면 탭 안에서 꺼낸 ViewModel이 셸이 보는 것과
 * 갈린다 — 탭마다 따로여야 하는 인스턴스는 아직 없다. 브라우저 API는 `infra/`의 얇은 함수로 감싼다 —
 * Model·ViewModel이 `navigator`·`document`를 직접 알면 테스트가 DOM에 묶인다.
 */
export const workbench: ExtensionModule = {
  id: "arka.workbench",
  provides: [
    { id: "arka.workbench.storage", lifetime: "singleton", create: createStoragePort },
    {
      id: "arka.workbench.serverInfo",
      lifetime: "singleton",
      create: () => {
        // 앱 수명과 워크스페이스가 같은 답을 읽는다 — 한 번만 묻고 나눈다.
        const port = createServerInfoPort();
        let loading: Promise<ServerInfo | null> | undefined;
        return { load: () => (loading ??= port.load()) };
      },
    },
    {
      id: "arka.commands",
      lifetime: "singleton",
      create: (c) => {
        // 재정의는 localStorage에 산다 — 서버 settings.json은 나중 라운드. 실행 오류는 오류 기록으로 간다.
        const storage = c.resolve("arka.workbench.storage");
        return new CommandService({
          overridesStore: {
            load: () => JSON.parse(storage.get(KEYBINDING_OVERRIDES_KEY) ?? "{}") as Record<string, string | null>,
            save: (overrides) => storage.set(KEYBINDING_OVERRIDES_KEY, JSON.stringify(overrides)),
          },
          reportError: (error) => c.resolve("arka.workbench.errorLog").report(error, "command"),
        });
      },
    },
    {
      id: "arka.settings",
      lifetime: "singleton",
      create: (c) => {
        // 설정도 localStorage에 산다 — 서버 settings.json은 나중 라운드.
        const storage = c.resolve("arka.workbench.storage");
        return new Settings({
          store: {
            load: () => JSON.parse(storage.get(SETTINGS_KEY) ?? "{}") as Record<string, unknown>,
            save: (values) => storage.set(SETTINGS_KEY, JSON.stringify(values)),
          },
        });
      },
    },
    { id: "arka.workbench.sidebar", lifetime: "singleton", create: () => new Registry() },
    { id: "arka.workbench.bottom", lifetime: "singleton", create: () => new Registry() },
    { id: "arka.workbench.tabSystem", lifetime: "singleton", create: () => new Registry() },
    { id: "arka.workbench.viewport", lifetime: "singleton", create: createViewportQuery },
    { id: "arka.workbench.errorLog", lifetime: "singleton", create: () => new ErrorLog() },
    { id: "arka.workbench.notifications", lifetime: "singleton", create: () => new Notifications() },
    {
      id: "arka.workbench.appLifetime",
      lifetime: "singleton",
      create: (c) =>
        new AppLifetime({ serverInfo: c.resolve("arka.workbench.serverInfo"), reload: () => location.reload() }),
    },
    {
      id: "arka.workbench.workspace",
      lifetime: "singleton",
      create: (c) => new Workspace({ serverInfo: c.resolve("arka.workbench.serverInfo") }),
    },
    {
      id: "arka.workbench.tabLayout",
      lifetime: "singleton",
      create: (c) => new TabLayout({ storage: c.resolve("arka.workbench.storage") }),
    },
    {
      id: "arka.workbench.tabs",
      lifetime: "singleton",
      // 탭 컨테이너의 부모는 이 모듈을 켠 컨테이너(앱 루트)다 — 탭 안에서 꺼내는 것이 셸이 보는 것과 같은 인스턴스가 된다.
      create: (c) =>
        new TabSystem({
          layout: c.resolve("arka.workbench.tabLayout"),
          providers: c.resolve("arka.workbench.tabSystem"),
          notifications: c.resolve("arka.workbench.notifications"),
          root: c,
        }),
    },
    {
      id: "arka.workbench.colorMode",
      lifetime: "singleton",
      create: (c) => new ColorMode({ storage: c.resolve("arka.workbench.storage") }),
    },
    {
      id: "arka.workbench.shellViewModel",
      lifetime: "singleton",
      create: (c) =>
        new ShellViewModel({
          sidebars: c.resolve("arka.workbench.sidebar"),
          bottoms: c.resolve("arka.workbench.bottom"),
          colorMode: c.resolve("arka.workbench.colorMode"),
          viewport: c.resolve("arka.workbench.viewport"),
          tabLayout: c.resolve("arka.workbench.tabLayout"),
          commands: c.resolve("arka.commands"),
        }),
    },
    {
      id: "arka.workbench.tabSystemViewModel",
      lifetime: "singleton",
      create: (c) =>
        new TabSystemViewModel({
          tabLayout: c.resolve("arka.workbench.tabLayout"),
          tabs: c.resolve("arka.workbench.tabs"),
          commands: c.resolve("arka.commands"),
          copyToClipboard: (text) => void navigator.clipboard.writeText(text),
        }),
    },
    {
      id: "arka.workbench.notificationViewModel",
      lifetime: "singleton",
      create: (c) => new NotificationViewModel({ notifications: c.resolve("arka.workbench.notifications") }),
    },
    {
      id: "arka.workbench.appStatusViewModel",
      lifetime: "singleton",
      create: (c) =>
        new AppStatusViewModel({
          appLifetime: c.resolve("arka.workbench.appLifetime"),
          workspace: c.resolve("arka.workbench.workspace"),
        }),
    },
    {
      id: "arka.workbench.settingsViewModel",
      lifetime: "singleton",
      create: (c) => new SettingsViewModel({ settings: c.resolve("arka.settings") }),
    },
    {
      id: "arka.workbench.commandPaletteViewModel",
      lifetime: "singleton",
      create: (c) => new CommandPaletteViewModel({ commands: c.resolve("arka.commands") }),
    },
    {
      id: "arka.workbench.keybindingViewModel",
      lifetime: "singleton",
      create: (c) => new KeybindingViewModel({ commands: c.resolve("arka.commands") }),
    },
    // 부팅 때 켜져 앱이 사는 동안 도는 배선 — 만드는 순간 켜진다.
    {
      id: "arka.workbench.globalErrorHandlers",
      lifetime: "singleton",
      create: (c) => createGlobalErrorHandlers({ errorLog: c.resolve("arka.workbench.errorLog") }),
    },
    {
      id: "arka.workbench.errorNotifier",
      lifetime: "singleton",
      create: (c) =>
        createErrorNotifier({
          errorLog: c.resolve("arka.workbench.errorLog"),
          notifications: c.resolve("arka.workbench.notifications"),
        }),
    },
    {
      id: "arka.workbench.documentTheme",
      lifetime: "singleton",
      create: (c) => createDocumentTheme({ colorMode: c.resolve("arka.workbench.colorMode") }),
    },
    {
      id: "arka.workbench.documentDensity",
      lifetime: "singleton",
      create: (c) => createDocumentDensity({ settings: c.resolve("arka.settings") }),
    },
    {
      id: "arka.workbench.globalKeybindings",
      lifetime: "singleton",
      create: (c) => createGlobalKeybindings({ commands: c.resolve("arka.commands") }),
    },
    {
      id: "arka.workbench.unloadGuard",
      lifetime: "singleton",
      create: (c) => createUnloadGuard({ tabs: c.resolve("arka.workbench.tabs") }),
    },
  ],
  activate: (c) => {
    // 설정 스키마 — 밀도. 확장이 `activate`에서 더하는 것과 같은 자리다.
    c.resolve("arka.settings").schema.add({
      id: DENSITY_SETTING_ID,
      title: "밀도",
      type: "enum",
      default: "auto",
      options: ["auto", "compact", "touch"],
    });
    const tabProviders = c.resolve("arka.workbench.tabSystem");
    tabProviders.add(settingsTabProvider);

    // 탭을 여는 길은 명령 하나다 — 사이드바·검색·미리보기가 전부 `arka.workbench.open`을 부른다. 문맥
    // `tab.active.*`는 확장이 "지금 보는 탭"을 셸을 모른 채 읽는 자리다.
    const commands = c.resolve("arka.commands");
    const activeTab = () => {
      const layout = c.resolve("arka.workbench.tabLayout");
      const leaf = findLeaf(layout.tree, layout.activePaneId);
      return leaf?.tabs.find((tab) => tab.id === leaf.activeTabId) ?? null;
    };
    commands.contexts.add({ id: "tab.active.uri", value: () => activeTab()?.uri ?? null });
    commands.contexts.add({ id: "tab.active.kind", value: () => activeTab()?.kind ?? null });
    commands.actions.add({
      id: "arka.workbench.open",
      label: "탭으로 열기",
      execute: (context) => {
        if (!isOpenContext(context)) return;
        void c.resolve("arka.workbench.tabs").open(context.uri, { preview: context.preview === true });
      },
    });
    commands.actions.add({
      id: "arka.workbench.retargetTabs",
      label: "탭: 옮겨진 경로 따라가기",
      execute: (context) => {
        if (!isRetargetContext(context)) return;
        c.resolve("arka.workbench.tabSystemViewModel").retargetTabs(context.oldPrefix, context.newPrefix);
      },
    });

    // 부팅 배선을 켠다 — 오류 핸들러가 첫째다: 뒤의 것이 켜지다 던져도 잡힌다.
    c.resolve("arka.workbench.globalErrorHandlers");
    c.resolve("arka.workbench.errorNotifier");
    c.resolve("arka.workbench.documentTheme");
    c.resolve("arka.workbench.documentDensity");
    c.resolve("arka.workbench.globalKeybindings");
    c.resolve("arka.workbench.unloadGuard");
    // ViewModel이 만들어지는 순간 자기 명령을 등록한다 — 화면이 뜨기 전에 단축키가 먹어야 한다.
    c.resolve("arka.workbench.shellViewModel");
    c.resolve("arka.workbench.tabSystemViewModel");
    c.resolve("arka.workbench.commandPaletteViewModel");
    c.resolve("arka.workbench.appStatusViewModel");
  },
};
