import { URI } from "#contracts";
import type { Disposable } from "#core/di";
import { Emitter } from "#core/events";
import type { IStorage } from "./IStorage";
import { ROOT_PANE_ID } from "./tabsShare";
import type { ITabLayout, OpenTab, PaneId, PaneNode } from "./ITabLayout";

/** 저장 형태 — `uri`가 문자열이다. `URI`는 클래스라 JSON을 그대로 못 탄다. */
type StoredTab = Omit<OpenTab, "uri"> & { readonly uri: string };
type StoredNode =
  | { kind: "leaf"; id: PaneId; tabs: readonly StoredTab[]; activeTabId: string | null; size?: number }
  | {
      kind: "split";
      id: PaneId;
      orientation: "horizontal" | "vertical";
      children: readonly StoredNode[];
      size?: number;
    };

/**
 * 옛 저장본의 `kind`는 화면 종류의 이름이었다. 지금은 provider의 id다 — 이름이 바뀐 것을 옮긴다.
 * 모르는 것은 그대로 둔다 — provider가 없으면 복원이 그 탭을 뺀다.
 */
const KIND_OF_LEGACY: Readonly<Record<string, string>> = {
  file: "arka.filesystem.text",
  settings: "arka.workbench.settings",
  keybindings: "arka.workbench.keybindings",
  markdownPreview: "arka.markdown.preview",
};

/**
 * 트리 도입 전·`uri` 도입 전 탭을 지금 모양으로 옮긴다. 옛 탭은 `kind`와 `id`로 무엇이었는지 안다.
 * 모르는 것은 버린다 — 열 수 없는 탭을 복원해 봐야 빈 칸이다.
 */
const legacyUriOf = (kind: string, id: string): URI | null => {
  switch (kind) {
    case "file":
      return URI.file(id);
    case "settings":
      return URI.parse("arka:///settings");
    // 단축키가 제 화면을 갖던 때의 탭 — 이제 설정 안의 한 범주라 거기로 보낸다.
    case "keybindings":
      return URI.parse("arka:///settings");
    case "markdownPreview":
      return id.startsWith("preview:") ? URI.parse(`markdown-preview:///${id.slice("preview:".length)}`) : null;
    default:
      return null;
  }
};

const restoreTab = (value: unknown): OpenTab | null => {
  if (typeof value !== "object" || value === null) return null;
  const { id, kind, title, uri } = value as { id?: unknown; kind?: unknown; title?: unknown; uri?: unknown };
  if (typeof id !== "string" || typeof kind !== "string" || typeof title !== "string") return null;
  try {
    const parsed = typeof uri === "string" ? URI.parse(uri) : legacyUriOf(kind, id);
    return parsed === null ? null : { id, kind: KIND_OF_LEGACY[kind] ?? kind, uri: parsed, title };
  } catch {
    return null;
  }
};

const restoreNode = (value: unknown): PaneNode | null => {
  if (typeof value !== "object" || value === null) return null;
  const node = value as Partial<StoredNode> & { tabs?: unknown; children?: unknown };
  if (node.kind === "leaf" && typeof node.id === "string" && Array.isArray(node.tabs)) {
    const tabs = node.tabs.map(restoreTab).filter((tab): tab is OpenTab => tab !== null);
    const activeTabId = tabs.some((tab) => tab.id === node.activeTabId)
      ? (node.activeTabId ?? null)
      : (tabs[0]?.id ?? null);
    return { kind: "leaf", id: node.id, tabs, activeTabId, ...(node.size === undefined ? {} : { size: node.size }) };
  }
  if (node.kind === "split" && typeof node.id === "string" && Array.isArray(node.children)) {
    const children = node.children.map(restoreNode).filter((child): child is PaneNode => child !== null);
    const orientation = node.orientation === "vertical" ? "vertical" : "horizontal";
    return {
      kind: "split",
      id: node.id,
      orientation,
      children,
      ...(node.size === undefined ? {} : { size: node.size }),
    };
  }
  return null;
};

const storeNode = (node: PaneNode): StoredNode =>
  node.kind === "leaf"
    ? { ...node, tabs: node.tabs.map((tab) => ({ ...tab, uri: tab.uri.toString() })) }
    : { ...node, children: node.children.map(storeNode) };

/** `ITabLayout`의 유일한 구현체 — 트리·활성 칸·미리보기를 `IStorage`에 지속하고, 옛 스키마를 지금 모양으로 옮긴다. */
export class TabLayout implements ITabLayout {
  static readonly #TREE_KEY = "workbench.tabTree";
  static readonly #ACTIVE_PANE_ID_KEY = "workbench.activePaneId";
  static readonly #PREVIEW_TAB_ID_KEY = "workbench.previewTabId";
  // 마이그레이션 전용 — 트리 도입 전(2026-08-31 이전) 버전이 쓰던 키. 새로 쓰지 않는다.
  static readonly #LEGACY_TABS_KEY = "workbench.tabs";
  static readonly #LEGACY_ACTIVE_TAB_ID_KEY = "workbench.activeTabId";

  readonly #storage: IStorage;
  readonly #changed = new Emitter();
  #tree: PaneNode;
  #activePaneId: PaneId;
  #previewTabId: string | null;

  /** 새로고침해도 탭이 남아 있어야 이 앱을 쓸 이유가 성립한다 — 그래서 값 셋 다 부팅 시 복원한다. */
  constructor({ storage }: { storage: IStorage }) {
    this.#storage = storage;
    this.#tree = TabLayout.#restoreTree(storage);
    this.#activePaneId = TabLayout.#restoreActivePaneId(storage);
    this.#previewTabId = TabLayout.#restoreId(storage, TabLayout.#PREVIEW_TAB_ID_KEY);
  }

  /** `#tree`를 그대로 노출한다. */
  get tree(): PaneNode {
    return this.#tree;
  }

  /** `#tree`에 반영하고 `IStorage`에 지속한다. */
  setTree(tree: PaneNode): void {
    if (this.#tree === tree) return;
    this.#tree = tree;
    this.#storage.set(TabLayout.#TREE_KEY, JSON.stringify(storeNode(tree)));
    this.#changed.fire();
  }

  /** `#activePaneId`를 그대로 노출한다. */
  get activePaneId(): PaneId {
    return this.#activePaneId;
  }

  /** `#activePaneId`에 반영하고 `IStorage`에 지속한다. */
  setActivePaneId(id: PaneId): void {
    if (this.#activePaneId === id) return;
    this.#activePaneId = id;
    this.#storage.set(TabLayout.#ACTIVE_PANE_ID_KEY, id);
    this.#changed.fire();
  }

  /** `#previewTabId`를 그대로 노출한다. */
  get previewTabId(): string | null {
    return this.#previewTabId;
  }

  /** `#previewTabId`에 반영하고 `IStorage`에 지속한다. 빈 문자열이 "없다"다 — localStorage는 null을 못 담는다. */
  setPreviewTabId(id: string | null): void {
    if (this.#previewTabId === id) return;
    this.#previewTabId = id;
    this.#storage.set(TabLayout.#PREVIEW_TAB_ID_KEY, id ?? "");
    this.#changed.fire();
  }

  /** 상태가 바뀔 때마다 부른다. */
  onDidChange(listener: () => void): Disposable {
    return this.#changed.event(listener);
  }

  /** 새 스키마(트리)를 먼저 읽는다. 없거나 깨졌으면 구 스키마(flat 배열)를 단일 루트 leaf로 옮긴다. 둘 다 없으면 빈 루트 leaf. */
  static #restoreTree(storage: IStorage): PaneNode {
    const raw = storage.get(TabLayout.#TREE_KEY);
    if (raw !== null) {
      try {
        const restored = restoreNode(JSON.parse(raw));
        if (restored !== null) return restored;
      } catch {
        // 새 스키마 파싱 실패 — 아래에서 구 스키마 이식을 시도한다.
      }
    }
    return TabLayout.#migrateLegacyTree(storage);
  }

  static #migrateLegacyTree(storage: IStorage): PaneNode {
    const activeTabId = TabLayout.#restoreId(storage, TabLayout.#LEGACY_ACTIVE_TAB_ID_KEY);
    const raw = storage.get(TabLayout.#LEGACY_TABS_KEY);
    let tabs: readonly OpenTab[] = [];
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        tabs = Array.isArray(parsed) ? parsed.map(restoreTab).filter((tab): tab is OpenTab => tab !== null) : [];
      } catch {
        tabs = [];
      }
    }
    return {
      kind: "leaf",
      id: ROOT_PANE_ID,
      tabs,
      activeTabId: tabs.some((tab) => tab.id === activeTabId) ? activeTabId : null,
    };
  }

  static #restoreActivePaneId(storage: IStorage): PaneId {
    const raw = storage.get(TabLayout.#ACTIVE_PANE_ID_KEY);
    return raw === null || raw === "" ? ROOT_PANE_ID : raw;
  }

  static #restoreId(storage: IStorage, key: string): string | null {
    const raw = storage.get(key);
    return raw === null || raw === "" ? null : raw;
  }
}
