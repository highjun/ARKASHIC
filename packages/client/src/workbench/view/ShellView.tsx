import { ContainerProvider, useViewModel } from "#core/viewmodel";
import { observer } from "mobx-react-lite";
import { Banner, ConfirmationDialog, CounterLabel } from "@primer/react";
import { Menu } from "#component/Menu";
import { Icon } from "#component/Icon";
import { IconButton } from "#component/IconButton";
import { ModeToggle } from "#component/ModeToggle";
import { Text } from "#component/Text";
import { CommandPalette } from "../component/CommandPalette";
import { Shell } from "../component/Shell";
import { Tab } from "../component/Tab";
import type { ReactNode } from "react";
import type { ICommandService } from "#core/commands";
import type { TabContentProps } from "../model/ITabProviderDescriptor";
import type { PaneRowNode, TabContextTarget, TabRow } from "../viewmodel/ITabSystemViewModel";
import styles from "./ShellView.module.css";

/**
 * DI·구독·마크업이 한 파일에 있다(2026-09-04, D9) — `useViewModel` 하나만 부른다는 규율
 * (`view-only-uses-view-model`)로 "DI를 아는 파일을 하나로 가둔다"를 지킨다. ViewModel 다섯을 꺼낸다 —
 * 뼈대·탭·알림·앱 상태·팔레트. 훅은 하나고 부르는 횟수가 여럿일 뿐이다.
 *
 * 전역 배선(키다운 디스패치·beforeunload 가드·테마 DOM 반영)은 여기 없다 — 앱 전체 단위 배선이라 `infra/`에 있다.
 *
 * 탭 닫기 확인은 `window.confirm` 대신 `ITabSystemViewModel.pendingClose` + `ConfirmationDialog`다
 * (2026-09-04 — 네이티브 대화상자는 앱 UI와 다르게 생겨 일관성이 없다는 판단).
 */

/** 트리의 탭 전부 — `renderContent`가 id로 본문을 찾는다. */
const collectRows = (node: PaneRowNode): readonly TabRow[] =>
  node.kind === "leaf" ? node.tabs : node.children.flatMap(collectRows);

/**
 * 탭 우클릭 메뉴 — `shell.tab.context`에 담긴 명령들을 `Tab.renderTabMenu` 자리에 항목으로 그린다.
 * 우클릭한 탭이 `context`로 명령에 전달된다.
 */
const buildTabMenu = (commands: ICommandService) => (paneId: string, tabId: string) => {
  const context: TabContextTarget = { paneId, tabId };

  const items = commands
    .matchMenuItems("shell.tab.context")
    .map((menuItem) => {
      const action = commands.actions.tryGet(menuItem.actionId);
      return action === undefined ? null : { actionId: menuItem.actionId, label: action.label };
    })
    .filter((item) => item !== null);

  return (
    <>
      {items.map((item) => (
        <Menu.Item key={item.actionId} onSelect={() => commands.execute(item.actionId, context)}>
          {item.label}
        </Menu.Item>
      ))}
    </>
  );
};

/**
 * 셸 화면. 다른 모듈을 셸에 잇는 **유일한 자리** — 사이드바·아래 창은 `IShellViewModel`이 레지스트리에서 풀어
 * 준 것을, 탭은 `ITabSystemViewModel`이 descriptor에서 풀어 준 것을 그린다. 어떤 모듈이 무엇을 등록했는지는
 * 조립부만 안다. **파일을 모른다** — 파일을 여는 것도 명령이다.
 */
export const ShellView = observer(function ShellView() {
  const shell = useViewModel("arka.workbench.shellViewModel");
  const tabs = useViewModel("arka.workbench.tabSystemViewModel");
  const notifications = useViewModel("arka.workbench.notificationViewModel");
  const appStatus = useViewModel("arka.workbench.appStatusViewModel");
  const palette = useViewModel("arka.workbench.commandPaletteViewModel");
  const commands = useViewModel("arka.commands");

  const tree = tabs.tree;
  const rowsById = new Map(collectRows(tree).map((row) => [row.id, row] as const));

  /** 탭 본문을 그 탭의 자식 컨테이너로 감싼다 — 탭 안에서 `useViewModel`이 꺼내는 것은 거기서 온다. */
  const renderContent = (_paneId: string, tabId: string): ReactNode => {
    const row = rowsById.get(tabId);
    if (row === undefined) return null;
    const contentProps: TabContentProps = { tabId };
    return (
      <ContainerProvider container={tabs.containerOf(tabId)}>
        <row.Content {...contentProps} />
      </ContainerProvider>
    );
  };

  const activeSidebar = shell.activeSidebar;
  const activeBottom = shell.activeBottom;
  const pendingClose = tabs.pendingClose;

  return (
    <>
      {/* 닫을 수 없다 — 낡은 채로 쓰면 요청이 426으로 죽는다. `role="status"`로 랜드마크 대신
          라이브 영역을 만든다: 이 띠는 처음부터 있는 것이 아니라 프로토콜이 어긋난 순간 나타나므로
          나타났다는 사실이 읽혀야 한다. `flush`는 화면 맨 위에 모서리 없이 붙이려는 것이다. */}
      {appStatus.isOutdated ? (
        <Banner
          role="status"
          variant="warning"
          layout="compact"
          flush
          title="새 버전이 있다"
          description="이 화면은 서버와 다른 프로토콜을 쓰고 있다."
          primaryAction={<Banner.PrimaryAction onClick={() => appStatus.reload()}>다시 불러오기</Banner.PrimaryAction>}
        />
      ) : null}
      <Shell
        colorMode={shell.colorMode}
        isNarrow={shell.isNarrow}
        overlays={
          <CommandPalette
            open={palette.isOpen}
            onOpenChange={(open) => (open ? palette.open() : palette.close())}
            query={palette.query}
            onQueryChange={(value) => palette.setQuery(value)}
            rows={palette.rows}
            onSelect={(actionId) => palette.run(actionId)}
          />
        }
        brand={
          <span className={styles["brandGroup"]}>
            <img src="/arka-mark.svg" alt="" width={20} height={20} />
            <span className={styles["brandText"]}>
              {appStatus.workspaceName === "" ? "ARKA" : appStatus.workspaceName}
            </span>
          </span>
        }
        actions={
          <span className={styles["trailingGroup"]}>
            <Text size="small" tone="muted" className={styles["buildId"]}>
              {appStatus.buildId}
            </Text>
            <Menu kind="dropdown">
              {/* **`asChild` 다** — Trigger 자신이 `button` 이라 `IconButton` 을 그 안에 넣으면 버튼이 중첩된다. */}
              <Menu.Trigger asChild>
                <span className={styles["bell"]}>
                  <IconButton
                    variant="invisible"
                    size="small"
                    aria-label={
                      notifications.items.length === 0 ? "알림 없음" : `알림 ${String(notifications.items.length)}건`
                    }
                    icon={() => <Icon iconId="bell" size="sm" />}
                  />
                  {notifications.items.length === 0 ? null : (
                    <CounterLabel scheme="primary" className={styles["bellBadge"]}>
                      {notifications.items.length}
                    </CounterLabel>
                  )}
                </span>
              </Menu.Trigger>
              <Menu.Content>
                {notifications.items.length === 0 ? (
                  <Menu.Label>온 것이 없다</Menu.Label>
                ) : (
                  notifications.items.map((item) => (
                    <Menu.Item key={item.id} onSelect={() => notifications.dismiss(item.id)}>
                      <Icon iconId={item.severity === "info" ? "bell" : item.severity} size="sm" />
                      {item.message}
                    </Menu.Item>
                  ))
                )}
              </Menu.Content>
            </Menu>
            <ModeToggle
              values={["light", "dark"]}
              value={shell.colorMode}
              labels={["어둡게 전환", "밝게 전환"]}
              onValueChange={() => shell.toggleColorMode()}
            >
              {[<Icon key="sun" iconId="sun" size="sm" />, <Icon key="moon" iconId="moon" size="sm" />]}
            </ModeToggle>
          </span>
        }
        sidebars={shell.sidebars}
        onSidebarSelect={(id) => shell.toggleSidebar(id)}
        onSettingsSelect={() => commands.execute("shell.openSettings")}
        sidebarTitle={activeSidebar?.title}
        sidebarContent={activeSidebar === null ? undefined : <activeSidebar.Content />}
        sidebarActions={activeSidebar?.actions}
        onSidebarActionActivate={(actionId) => commands.execute(actionId)}
        sidebarOpen={shell.isSidebarOpen}
        onSidebarOpenChange={(open) => shell.setSidebarOpen(open)}
        sidebarResizable
        sidebarWidthStorageKey="arka-workbench:sidebar-width"
        bottoms={shell.bottoms}
        bottomContent={activeBottom === null ? undefined : <activeBottom.Content />}
        onBottomSelect={(id) => shell.toggleBottom(id)}
      >
        <Tab
          className={styles["tab"]}
          chrome="none"
          tree={tree}
          activePaneId={tabs.activePaneId}
          isNarrow={shell.isNarrow}
          renderContent={renderContent}
          onSelect={(paneId, tabId) => tabs.selectTab(paneId, tabId)}
          onClose={(paneId, tabId) => tabs.requestCloseTab(paneId, tabId)}
          onReorder={(paneId, nextTabIds) => tabs.reorderTabs(paneId, nextTabIds)}
          onPin={(_paneId, tabId) => tabs.pinTab(tabId)}
          onSplit={(paneId, tabId, edge) => tabs.splitTab(paneId, tabId, edge)}
          onResize={(branchId, childId, nextSize) => tabs.resizePane(branchId, childId, nextSize)}
          renderTabMenu={buildTabMenu(commands)}
          emptyMessage={
            <Text size="small" tone="muted">
              탐색기에서 파일을 고르세요.
            </Text>
          }
        />
      </Shell>

      {pendingClose === null ? null : (
        <ConfirmationDialog
          title="저장하지 않은 변경사항이 있다"
          confirmButtonContent="닫기"
          cancelButtonContent="취소"
          confirmButtonType="danger"
          onClose={(gesture) => (gesture === "confirm" ? tabs.confirmClose() : tabs.cancelClose())}
        >
          닫으면 사라진다 — 그래도 닫을까?
        </ConfirmationDialog>
      )}
    </>
  );
});
