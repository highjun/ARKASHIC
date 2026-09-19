# v1.0 workbench 계약 — TO-BE

`packages/client/src/workbench/`가 내보낼 표면 전부다. 확장이 여기에만 기댄다.
커널의 계약은 [core.md](core.md)다 — 여기 나오는 `Descriptor`·`Registry`·`Container`·`InstanceId`는 거기 것이다.
`IconId`는 `shared/component/Icon` 것이다 — `ICON_MAP`에 올린 이름만 통과하는 닫힌 집합.

**검토 중이다.** 확장 등록·기여 지점은 봤고, 워크스페이스부터는 아직이다.

---

## `workbench/` — 확장 등록

workbench가 확장에 내주는 자리는 **화면의 세 슬롯**이다. 확장은 `activate(container)`에서 꺼내 `add`한다.

- **Sidebar** — 사이드바에 무엇을 보여줄지. 활동 레일의 아이콘과 사이드바 내용이 한 덩어리다
- **TabSystem** — 탭 시스템에 어떤 창을 띄울지
- **Bottom** — 아래 창에 무엇을 띄울지. 터미널이 여기다

```ts
declare module "#core/di" {
  interface InstanceMap {
    "arka.workbench.sidebar": Registry<SidebarDescriptor>;
    "arka.workbench.tabSystem": Registry<TabProviderDescriptor>;
    "arka.workbench.bottom": Registry<BottomDescriptor>;
  }
}
```

명령·문맥·키바인딩·메뉴 넷과 설정 스키마는 여기 없다 — `ICommandService`·`ISettings` 안에 있다(→ [core.md](core.md)).
부팅 때 돌아야 하는 것은 따로 신고하지 않는다 — `activate`에서 `resolve`하면 그때 만들어져 켜진다.

## `workbench/` — 기여 지점

### Sidebar

```ts
/**
 * 사이드바 하나. 활동 레일의 아이콘과 사이드바 내용이 한 덩어리다 — 아이콘을 누르면 이 내용이 열린다.
 *
 * **크롬은 커널이 두른다** — 확장은 본문과 액션만 낸다.
 *
 * **슬롯이 아무것도 안 받는다** — 확장이 필요한 것은 DI로 꺼낸다. 커널이 "파일"처럼 확장의
 * 어휘를 계약에 박으면 그것을 안 쓰는 확장에게도 내밀게 된다.
 */
export interface SidebarDescriptor extends Descriptor {
  readonly title: string;
  readonly iconId: IconId;
  readonly Content: ComponentType;
  /** 머리 오른쪽의 아이콘 버튼들. 자주 쓰는 것 한둘이다. */
  readonly actions?: readonly SidebarAction[];
}

/** 사이드바 머리의 버튼 하나. 명령을 부를 뿐이다 — 라벨과 실행은 명령 쪽 것을 쓴다. */
export interface SidebarAction {
  readonly actionId: string;
  readonly iconId: IconId;
}
```

### TabSystem

탭에 열리는 것은 전부 **`Uri` 하나로 가리킨다** — `file:///…/a.pdf`도 `arka:settings`도 같은 좌표다.
커널이 탭에 대해 아는 것은 `uri`와 더티 여부뿐이다.

```ts
/**
 * 탭 시스템에 창을 띄우는 것. **확장이 신고하고 커널이 고른다** — 커널은 확장 이름을 모른다.
 * `id`가 `OpenTab.kind`가 된다 — 복원할 때 같은 것을 다시 찾는 열쇠다.
 *
 * 패턴이 아니라 함수인 이유: 텍스트 확장은 "텍스트면 전부"라 확장자 목록으로 표현할 수 없다.
 */
export interface TabProviderDescriptor extends Descriptor {
  /** 클수록 먼저 묻는다. 텍스트 확장이 바닥이다 — 다들 거절한 뒤에야 바이트를 읽어 판정한다. */
  readonly priority: number;
  /**
   * 열 수 있으면 그릴 것을 돌려준다. 못 열면 `undefined` — 다음 것에게 넘어간다.
   * 판정에 I/O가 필요하면(텍스트인가) 여기서 한다. **커널은 바이트를 모른다.**
   */
  readonly openTab: (uri: Uri) => Promise<TabDescriptor | undefined>;
}

/**
 * 탭 안에 그릴 것. **레지스트리가 아니다** — `openTab`이 만들어 돌려주는 값이다.
 * 텍스트·PDF·`.db`·설정 화면이 전부 이 하나로 꽂힌다.
 *
 * **provider가 쥔 MobX observable 객체다.** `title`·`isDirty`를 바꾸면 화면이 따라온다 —
 * 이름 없는 문서가 저장되며 이름을 얻을 때, 더티가 켜지고 꺼질 때. observable로 안 만들면 조용히 안 바뀐다.
 */
export interface TabDescriptor {
  readonly icon: ReactNode;
  readonly title: string;
  /** 저장 안 한 변경이 있나. 커널이 ● 표시와 닫기 확인에 쓴다. */
  readonly isDirty: boolean;
  readonly Content: ComponentType<TabContentProps>;
}

/** 탭 내용이 받는 것. **커널은 탭 안을 모른다** — id만 넘긴다. 자리 지정(anchor)은 나중에 다시 본다. */
export interface TabContentProps {
  readonly tabId: string;
}

/** `open`에 딸리는 것. */
export interface OpenOptions {
  /** 미리보기 자리에 연다 — 전역 하나라 다음 미리보기가 이 탭을 갈아 끼운다. 한 번 더 열면 고정된다. */
  readonly preview?: boolean;
}

/** 무엇이든 탭으로 연다. `arka.workbench.open` 명령이 이것을 부른다. */
export interface ITabSystem {
  /**
   * `priority` 순으로 provider에게 묻고 처음 받는 것으로 연다.
   * 같은 `uri`가 이미 열려 있으면 새로 열지 않고 그 탭을 활성화한다. 아무도 못 열면 알림을 낸다.
   */
  open(uri: Uri, options?: OpenOptions): Promise<void>;
  /** 새로고침 복원. `kind`로 provider를 바로 찾아 `openTab`을 다시 부른다 — 우선순위를 안 돈다. */
  restore(tabs: readonly OpenTab[]): Promise<void>;
  /**
   * 그 탭의 자식 컨테이너. **탭 목록에서 파생한다** — 목록에 생기면 따고 빠지면 `dispose`한다.
   * 부르는 자리가 없어 빠뜨릴 수 없다. 셸이 탭 본문을 `ContainerProvider`로 감쌀 때 쓴다.
   * @throws DescriptorNotFoundError 그 id의 탭이 없다.
   */
  containerOf(tabId: string): Container;
}
```

### Bottom

```ts
/** 아래 창에 사는 것. 터미널이 이 자리다. */
export interface BottomDescriptor extends Descriptor {
  readonly title: string;
  readonly iconId: IconId;
  readonly Content: ComponentType;
}
```

## `workbench/` — 워크스페이스

```ts
/** 무엇이 작업 범위인가. **루트는 하나**고 서버 설정으로 고정된다 — 앱 안에서 바꾸지 않는다. */
export interface IWorkspace {
  readonly root: Uri;
  /** 화면에 보이는 이름. 루트 디렉터리 이름이다. */
  readonly name: string;
  /** 루트 기준 상대 경로를 절대 Uri로 만든다. 루트 밖을 가리키면 던진다. */
  resolve(relativePath: string): Uri;
  /** 위의 반대. 루트 밖이면 `null`. */
  relativize(uri: Uri): string | null;
}

/** 파일·리소스를 가리키는 좌표. **모두가 이것을 쓴다** — 문자열 경로를 돌리지 않는다. */
export interface Uri {
  readonly scheme: string;
  readonly path: string;
  /** `Map`·`Set` 키로 쓸 때 이것을 쓴다. */
  toString(): string;
}

/** `Uri`를 만드는 유일한 길. 문자열을 직접 조립하지 않는다. */
export declare const Uri: {
  parse(value: string): Uri;
  file(path: string): Uri;
};
```

## `workbench/` — 탭

```ts
/** 열린 탭 하나. **직렬화 가능한 것만** 담는다 — 서버에 저장되고 새로고침 뒤 돌아온다. */
export interface OpenTab {
  readonly id: string;
  /** 연 `TabProviderDescriptor.id`. 복원할 때 같은 것의 `openTab`을 다시 부른다. */
  readonly kind: string;
  /** 무엇을 열었나. 커널이 탭에 대해 아는 것은 이것과 더티 여부뿐이다. 저장은 `toString()`으로. */
  readonly uri: Uri;
  readonly title: string;
}

/** 분할 트리의 잎을 가리키는 불투명 문자열. 탭 id와 다른 이름 공간이다. */
export type PaneId = string;

/** 칸을 가르는 방향. */
export type SplitOrientation = "horizontal" | "vertical";

/** 탭이 실제로 놓이는 칸. */
export interface PaneLeaf {
  readonly kind: "leaf";
  readonly id: PaneId;
  readonly tabs: readonly OpenTab[];
  readonly activeTabId: string | null;
  /** 형제 사이의 비율. 없으면 균등. */
  readonly size?: number;
}

/** 칸을 둘 이상으로 가른 가지. 자기 탭은 없다. */
export interface PaneSplit {
  readonly kind: "split";
  readonly id: PaneId;
  readonly orientation: SplitOrientation;
  readonly children: readonly PaneNode[];
  readonly size?: number;
}

/** `kind`로 갈리는 판별 유니온. */
export type PaneNode = PaneLeaf | PaneSplit;

/**
 * 무엇이 열려 있나. **서버가 저장한다** — 새로고침해도 돌아오고 기기가 바뀌어도 같다.
 *
 * setter는 "다음 값이 뭐여야 하는지"를 계산하지 않는다. 그 판단은 ViewModel에 있다.
 */
export interface ITabLayout {
  readonly tree: PaneNode;
  setTree(tree: PaneNode): void;
  /** 지금 조작 대상인 칸. 분할이 여러 개여도 하나다. */
  readonly activePaneId: PaneId;
  setActivePaneId(id: PaneId): void;
  /** 미리보기 자리에 있는 탭. **전역 하나다** — 다음 파일을 열면 이 탭이 갈린다. */
  readonly previewTabId: string | null;
  setPreviewTabId(id: string | null): void;
  onDidChange(listener: () => void): Disposable;
}

/** **커널이 탭 안에 대해 아는 것은 이것뿐이다.** 무엇이 더러운지는 그 탭을 그린 확장이 안다. */
export interface IDirtyState {
  /** 없거나 더러워질 수 없는 탭이면 `false`. */
  isDirty(tabId: string): boolean;
  /** 어느 탭이든 저장 안 된 것이 있나. 떠날 때 묻는 자리가 쓴다. */
  hasAnyDirty(): boolean;
  onDidChange(listener: () => void): Disposable;
}
```

## `workbench/` — 모드

```ts
/** 밝기 모드. 테마 레지스트리는 없다 — light·dark 둘뿐이고 헤더의 ModeToggle이 바꾼다. */
export interface IColorMode {
  readonly mode: "light" | "dark";
  setMode(mode: "light" | "dark"): void;
  onDidChange(listener: () => void): Disposable;
}
```

## `workbench/` — 앱 수명

```ts
/**
 * 앱이 새로 떠야 하는 자리를 한곳에 모은다.
 *
 * 서버가 프로토콜 버전이 안 맞다고 소켓을 끊으면 여기로 온다. 더티 탭이 있으면 떠나기 전에 묻는다.
 */
export interface IAppLifetime {
  /** 서버가 말하는 프로토콜 버전이 이 클라이언트와 다르다 — 캐시된 PWA가 낡았다. */
  readonly isOutdated: boolean;
  /** 화면 구석에 띄우는 빌드 표시. 아직 못 읽었으면 빈 문자열. */
  readonly buildId: string;
  requestReload(reason: "versionMismatch" | "userRequested"): void;
  onDidChange(listener: () => void): Disposable;
}
```

## `workbench/` — 알림과 오류

```ts
/** 알림의 무게. */
export type Severity = "info" | "warning" | "error";

/** 알림 하나. 닫을 때까지 남는다. */
export interface Notification {
  readonly id: string;
  readonly severity: Severity;
  readonly message: string;
}

/** 쌓이는 알림. 확장도 여기에 낸다 — **그것이 어떻게 보이는지는 모른다**(지금은 제목 줄의 종이다). */
export interface INotifications {
  readonly items: readonly Notification[];
  /** 돌려주는 것은 나중에 지울 수 있는 id다. */
  notify(severity: Severity, message: string): string;
  dismiss(id: string): void;
  onDidChange(listener: () => void): Disposable;
}

/** 잡힌 오류가 모이는 자리. 렌더 경계와 전역 핸들러가 부른다. */
export interface IErrorLog {
  /** `source`는 어디서 잡았나 — `render`·`unhandledRejection` 같은 것. */
  report(error: unknown, source: string): void;
}
```

## `workbench/viewmodel` — 화면 상태

하나였던 셸 ViewModel을 관심사로 가른다. 넷 다 자기 상태를 갖지 않고 Model에서 파생한다.

```ts
/** 뼈대. 루트 컨테이너에 살므로 이 VM의 수명이 "앱이 사는 동안"이다. */
export interface IShellViewModel extends Disposable {
  readonly sidebars: readonly SidebarRow[];
  /** 지금 열린 사이드바. VM이 레지스트리에서 풀어 준다 — **View는 레지스트리를 모른다.** */
  readonly activeSidebar: ActiveSidebar | null;
  /** 같은 것을 다시 고르면 사이드바가 닫힌다. */
  toggleSidebar(id: string): void;
  /** 명령·단축키가 부른다. 이미 열려 있으면 그대로 둔다. */
  revealSidebar(id: string): void;
  readonly bottoms: readonly BottomRow[];
  /** 지금 열린 아래 창. 위와 같다. */
  readonly activeBottom: ActiveBottom | null;
  toggleBottom(id: string): void;
  /** 좁은 화면인가. 탭을 띠로 늘어놓지 않고 하나만 보여줄지를 이것으로 가른다. */
  readonly isNarrow: boolean;
}

/** 활동 레일에 그릴 사이드바 한 줄. */
export interface SidebarRow {
  readonly id: string;
  readonly title: string;
  readonly iconId: IconId;
  readonly isActive: boolean;
}

/** 열린 사이드바 하나를 그리는 데 필요한 전부. */
export interface ActiveSidebar {
  readonly id: string;
  readonly title: string;
  readonly Content: ComponentType;
  readonly actions: readonly SidebarActionRow[];
}

/** 열린 아래 창 하나를 그리는 데 필요한 전부. */
export interface ActiveBottom {
  readonly id: string;
  readonly Content: ComponentType;
}

/** 사이드바 머리의 버튼 한 줄. `label`은 명령의 것이다 — 툴팁으로 쓴다. */
export interface SidebarActionRow {
  readonly actionId: string;
  readonly iconId: IconId;
  readonly label: string;
}

/** 아래 창의 탭 한 줄. */
export interface BottomRow {
  readonly id: string;
  readonly title: string;
  readonly iconId: IconId;
  readonly isActive: boolean;
}

/** 탭과 분할. 조작의 판단이 전부 여기 있다 — Model은 값만 든다. */
export interface ITabSystemViewModel {
  readonly tree: PaneRowNode;
  readonly activePaneId: PaneId;
  /** 익스텐션 명령("지금 파일의 미리보기")이 읽는다. */
  readonly activeTab: { readonly id: string; readonly kind: string } | null;

  selectTab(paneId: PaneId, tabId: string): void;
  /** 더티면 확인을 구한다. 아니면 바로 닫는다. */
  requestCloseTab(paneId: PaneId, tabId: string): void;
  readonly pendingClose: { readonly paneId: PaneId; readonly tabId: string } | null;
  confirmClose(): void;
  cancelClose(): void;
  /** 더티인 탭은 조용히 남긴다 — 확인창을 여러 개 띄우지 않는다. */
  closeOthers(paneId: PaneId, tabId: string): void;
  closeToRight(paneId: PaneId, tabId: string): void;

  reorderTabs(paneId: PaneId, nextTabIds: readonly string[]): void;
  /** 가장자리로 떼어내 새 칸을 만든다. 합치기는 여기 없다. */
  splitTab(paneId: PaneId, tabId: string, edge: SplitEdge): void;
  resizePane(branchId: PaneId, childId: PaneId, nextSize: number): void;

  /** 미리보기 탭을 고정한다. 여는 것은 여기 없다 — 명령이 `ITabSystem.open`을 부른다. */
  pinTab(tabId: string): void;
  /** 파일이 옮겨졌다 — 그 경로를 보던 탭이 따라간다. */
  retargetTabs(oldPrefix: string, newPrefix: string): void;
}

/** 새 분할을 만드는 넷. */
export type SplitEdge = "left" | "right" | "top" | "bottom";

/** 탭 우클릭 메뉴(`menuId: 'shell.tab.context'`) 명령이 받는 대상. */
export interface TabContextTarget {
  readonly paneId: PaneId;
  readonly tabId: string;
}

/** 화면이 그릴 탭 한 줄. 그리는 데 필요한 전부를 싣는다 — View는 레지스트리도 `ITabSystem`도 모른다. */
export interface TabRow {
  readonly id: string;
  readonly kind: string;
  /** 아래 셋은 provider가 돌려준 `TabDescriptor`에서 온다 — VM이 `ITabSystem`에서 풀어 준다. */
  readonly title: string;
  readonly icon: ReactNode;
  readonly Content: ComponentType<TabContentProps>;
  /** 미리보기 자리에 있다. 화면은 기울임으로 알린다. */
  readonly isPreview: boolean;
  readonly isDirty: boolean;
}

/** 화면이 그릴 칸 하나. Model의 `PaneLeaf`와 구조가 같고 탭이 `TabRow`다. */
export interface PaneRowLeaf {
  readonly kind: "leaf";
  readonly id: PaneId;
  readonly tabs: readonly TabRow[];
  readonly activeTabId: string | null;
  readonly size?: number;
}

/** `PaneRowLeaf`와 짝을 이루는 가지. */
export interface PaneRowSplit {
  readonly kind: "split";
  readonly id: PaneId;
  readonly orientation: SplitOrientation;
  readonly children: readonly PaneRowNode[];
  readonly size?: number;
}

/** `kind`로 갈리는 판별 유니온. */
export type PaneRowNode = PaneRowLeaf | PaneRowSplit;

/** 쌓인 알림. 안 읽은 수가 제목 줄 종의 배지로 뜨고, 누르면 목록이 열린다. */
export interface INotificationViewModel {
  readonly items: readonly Notification[];
  dismiss(id: string): void;
}

/** 앱 자체의 상태 — 낡은 클라이언트 띠와 워크스페이스 이름. */
export interface IAppStatusViewModel {
  readonly workspaceName: string;
  readonly buildId: string;
  readonly isOutdated: boolean;
  reload(): void;
}

/** 설정 화면. 등록된 스키마를 줄로 펴고 값을 물린다. */
export interface ISettingsViewModel {
  readonly rows: readonly SettingsRow[];
  set(id: string, value: unknown): void;
}

/** 설정 화면의 한 줄. 스키마와 지금 값을 함께 든다. */
export interface SettingsRow {
  readonly id: string;
  readonly title: string;
  readonly type: "boolean" | "number" | "string" | "enum";
  readonly value: unknown;
  readonly options?: readonly string[];
}

/** 명령 팔레트. 등록된 명령을 걸러 보여주고 고른 것을 실행한다. */
export interface ICommandPaletteViewModel {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  readonly query: string;
  setQuery(value: string): void;
  readonly rows: readonly CommandRow[];
  run(actionId: string): void;
}

/** 팔레트의 한 줄. */
export interface CommandRow {
  readonly id: string;
  readonly label: string;
  /** 이 명령에 걸린 키. 없으면 빈 문자열. */
  readonly keybinding: string;
}

/** 단축키 표. 충돌을 함께 보여준다. */
export interface IKeybindingViewModel {
  readonly rows: readonly KeybindingRow[];
}

/** 단축키 표의 한 줄. */
export interface KeybindingRow {
  readonly actionId: string;
  readonly label: string;
  readonly keybinding: string;
  /** 같은 키에 둘 이상이 걸렸다. */
  readonly isConflicting: boolean;
}
```

---

## `workbench/component` — Props

컴포넌트는 원소 속성 위에 얇게 얹고 변형은 `data-<축>`으로 싣는다(→ [ADR 0008](../adr/0008-component-surface.md)).

```ts
/**
 * 앱의 뼈대. 확장이 꽂히는 자리를 전부 낸다.
 *
 * 슬롯이 셋을 넘지만 부품으로 가르지 않는다 — Primer `SplitPageLayout`이 자식을 참조 동일성으로
 * 골라내므로 그 안에 우리 부품을 끼우면 부모가 못 알아본다.
 */
export interface ShellProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  readonly ref?: Ref<HTMLDivElement>;
  readonly colorMode: "light" | "dark";
  /** 좁은 화면이면 사이드바·아래 창이 겹쳐 뜨고 탭이 하나만 보인다. */
  readonly isNarrow?: boolean;

  readonly sidebars?: readonly SidebarRow[];
  readonly onSidebarSelect?: (id: string) => void;

  readonly sidebarTitle?: string;
  readonly sidebarContent?: ReactNode;
  readonly sidebarActions?: readonly SidebarActionRow[];
  readonly onSidebarActionActivate?: (actionId: string) => void;
  readonly sidebarOpen?: boolean;
  readonly onSidebarOpenChange?: (open: boolean) => void;

  readonly bottoms?: readonly BottomRow[];
  readonly bottomContent?: ReactNode;
  readonly onBottomSelect?: (id: string) => void;

  /** 탭 시스템이 여기 온다. */
  readonly children: ReactNode;
  /** 팔레트·대화상자·알림처럼 위에 뜨는 것. */
  readonly overlays?: ReactNode;
}

/**
 * 사이드바를 고르는 세로 아이콘 줄. **위와 아래는 완전히 별개의 묶음이다** — 사이를 늘어나는
 * 빈 칸이 밀어, 위가 넘쳐 스크롤이 생겨도 아래는 제자리에 남는다. 설정도 아래 묶음의 한 줄이라
 * 레일은 그것이 설정인지 모르고 id 만 넘긴다.
 */
export interface ActivityBarProps extends Omit<ComponentPropsWithoutRef<"nav">, "onSelect"> {
  readonly ref?: Ref<HTMLElement>;
  readonly topItems: readonly SidebarRow[];
  readonly bottomItems?: readonly SidebarRow[];
  readonly onSelect?: (id: string) => void;
  readonly renderItemMenu?: (item: SidebarRow) => ReactNode;
}

/**
 * 탭과 분할. `tree`를 주면 분할, `tabs`만 주면 단일 그룹이다.
 *
 * 부품은 `Object.assign`으로 붙인다 — `Tab.Strip`·`Tab.Header`·`Tab.Group`·`Tab.Split`.
 */
export type TabProps = (TabSplitProps | (TabGroupProps & { readonly tree?: never })) & {
  readonly ref?: Ref<HTMLElement>;
};

/** 한 칸 안의 탭 띠와 내용. */
export interface TabGroupProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  readonly tabs: readonly TabRow[];
  readonly activeTabId: string | null;
  /** 좁은 화면이면 띠 대신 "지금 탭 하나 + 목록에서 고르기"로 접힌다. */
  readonly isNarrow?: boolean;
  readonly content?: ReactNode;
  readonly onSelect?: (tabId: string) => void;
  readonly onClose?: (tabId: string) => void;
  readonly onReorder?: (nextTabIds: readonly string[]) => void;
  readonly onPin?: (tabId: string) => void;
  readonly renderTabMenu?: (tabId: string) => ReactNode;
}

/** 분할 트리. 재귀로 그린다. */
export interface TabSplitProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "onDragStart" | "onDrop"> {
  readonly tree: PaneRowNode;
  readonly activePaneId: PaneId;
  readonly renderContent?: (paneId: PaneId, tabId: string) => ReactNode;
  readonly onSelect?: (paneId: PaneId, tabId: string) => void;
  readonly onClose?: (paneId: PaneId, tabId: string) => void;
  readonly onSplit?: (paneId: PaneId, tabId: string, edge: SplitEdge) => void;
  readonly onResize?: (branchId: PaneId, childId: PaneId, nextSize: number) => void;
}

/** 탭 하나의 머리. 닫기 버튼이 탭 **밖에** 있다 — 안에 두면 중첩 상호작용이 된다. */
export interface TabHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "children" | "title"> {
  readonly tab: TabRow;
  readonly isActive?: boolean;
  readonly onSelect?: () => void;
  readonly onClose?: () => void;
}

/** 명령 팔레트. */
export interface CommandPaletteProps
  extends Omit<ComponentPropsWithoutRef<"div">, "onSelect" | "defaultValue"> {
  readonly open: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly query: string;
  readonly onQueryChange?: (value: string) => void;
  readonly rows: readonly CommandRow[];
  readonly onSelect?: (actionId: string) => void;
}

/** 단축키 표. **설정 화면 안의 한 범주다** — 제 화면을 갖지 않는다. */
export interface KeybindingTableProps extends Omit<ComponentPropsWithoutRef<"table">, "children"> {
  readonly rows: readonly KeybindingRow[];
}
```
