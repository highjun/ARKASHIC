import { useState } from "react";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { clsx } from "clsx";
import { PortalProvider } from "#utils/portal";
import styles from "./Shell.module.css";
import { SplitPageLayout, ThemeProvider } from "@primer/react";
import { Container } from "#component/Container";
import { Panel } from "../Panel";
import { Icon } from "#component/Icon";
import { IconButton } from "#component/IconButton";
import { ActivityBar } from "../ActivityBar";
import type { SidebarRow } from "../ActivityBar";
import type { IconId } from "#component/Icon";

/** 사이드바 머리의 버튼 한 줄 — `workbench/viewmodel`의 `SidebarActionRow`와 구조가 같다(부품은 그 층을 못 본다). */
interface SidebarActionRow {
  readonly actionId: string;
  readonly iconId: IconId;
  /** 명령의 이름 — 툴팁으로 쓴다. */
  readonly label: string;
}

/** 아래 창의 탭 한 줄 — `workbench/viewmodel`의 `BottomRow`와 구조가 같다. */
interface BottomRow {
  readonly id: string;
  readonly title: string;
  readonly iconId: IconId;
  readonly isActive: boolean;
}

/** 패널이 없으면(아이콘 바만) 좁게, 있으면(아이콘 바+패널) 넓게 — 폭 값 자체는 워크벤치가 쓰던
 * 값을 그대로 컴포넌트 기본으로 가져온다. */
const COLLAPSED_WIDTH = { min: "48px", default: "48px", max: "48px" } as const;
const EXPANDED_WIDTH = { min: "304px", default: "304px", max: "304px" } as const;
/** `sidebarResizable`일 때 쓰는 기본 최소/최대 — 최소는 `sidebarMinWidth`로 덮어쓸 수 있다. */
const RESIZABLE_DEFAULT_MIN_WIDTH = "240px";
const RESIZABLE_MAX_WIDTH = "480px";

const hasContent = (node: ReactNode): boolean => node !== null && node !== undefined && node !== false;

/** 레일 아래 묶음의 설정 줄. 사이드바 id 와 겹치지 않게 접두사를 붙인다. */
const SETTINGS_ID = "shell.settings";
const SETTINGS_ROW: readonly SidebarRow[] = [
  { id: SETTINGS_ID, title: "설정", iconId: "settingsGear", isActive: false },
];

/**
 * 앱의 뼈대. 확장이 꽂히는 자리를 전부 낸다. `children`을 막는다 — 슬롯이 정해져 있어 아무 자식이나 받지 않는다.
 *
 * 슬롯이 셋을 넘지만 부품으로 가르지 않는다 — Primer `SplitPageLayout`이 자식을 참조 동일성으로
 * 골라내므로 그 안에 우리 부품을 끼우면 부모가 못 알아본다.
 */
export interface ShellProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** 루트 원소로 그대로 통과한다. */
  readonly ref?: Ref<HTMLDivElement>;
  /** Primer `ThemeProvider`에 그대로 전달되는 색 모드. */
  readonly colorMode: "light" | "dark";
  /** 좁은 화면인가. 지금은 `data-narrow`로만 실린다 — 겹쳐 뜨는 표현은 아직 미디어쿼리가 한다. */
  readonly isNarrow?: boolean;

  /** 사이드바 토글 버튼(모바일 전용) 뒤에 이어지는 앱 정체성. 계약 밖이다. */
  readonly brand?: ReactNode;
  /** 헤더 우측 — 실행 가능한 액션들. 계약 밖이다. */
  readonly actions?: ReactNode;

  /** 주면 사이드바(활동 레일+패널)가 생긴다 — 안 주면 사이드바 자체가 없다(헤더의 모바일 토글 버튼도 안 뜬다). */
  readonly sidebars?: readonly SidebarRow[];
  /** 레일의 아이콘을 클릭하면 그 id와 함께 호출된다. */
  readonly onSidebarSelect?: (id: string) => void;
  /** 레일 맨 아래 설정 톱니를 누르면 호출된다. 계약 밖이다. */
  readonly onSettingsSelect?: () => void;

  /** 열린 사이드바의 제목. 없으면 패널 머리 행 자체가 없다. */
  readonly sidebarTitle?: string;
  /** 열린 사이드바의 본문. `null`/`undefined`면 패널이 없어(레일만) 사이드바가 좁게 뜬다. */
  readonly sidebarContent?: ReactNode;
  /** 패널 머리 오른쪽에 놓이는 아이콘 버튼들 — 명령이다. */
  readonly sidebarActions?: readonly SidebarActionRow[];
  /** 머리의 버튼을 누르면 그 명령 id와 함께 호출된다. */
  readonly onSidebarActionActivate?: (actionId: string) => void;
  /** 모바일 드로어(사이드바) 열림 여부(제어). 안 주면 컴포넌트가 닫힌 채로 스스로 든다. */
  readonly sidebarOpen?: boolean;
  /** 사이드바 열림 여부가 바뀔 때마다(제어 여부 무관) 호출된다. */
  readonly onSidebarOpenChange?: (open: boolean) => void;
  /** 사이드바를 드래그로 폭 조절 가능하게 한다. 기본 `false`(고정폭). 계약 밖이다. */
  readonly sidebarResizable?: boolean;
  /** `sidebarResizable`일 때의 최소 폭. 예: `'200px'`. 계약 밖이다. */
  readonly sidebarMinWidth?: `${number}px`;
  /** `sidebarResizable`일 때 폭을 기억할 `localStorage` 키. 계약 밖이다. */
  readonly sidebarWidthStorageKey?: string;

  /** 주면 아래 창(탭 띠)이 생긴다 — 안 주거나 비면 아래 창 자체가 없다. */
  readonly bottoms?: readonly BottomRow[];
  /** 열린 아래 창의 본문. 없으면 띠만 남는다. */
  readonly bottomContent?: ReactNode;
  /** 아래 창의 탭을 누르면 그 id와 함께 호출된다. */
  readonly onBottomSelect?: (id: string) => void;

  /** 탭 시스템이 여기 온다. Shell 은 안에 뭐가 들었는지 모른다. */
  readonly children: ReactNode;
  /** `SplitPageLayout` 밖, `PortalProvider` 안의 형제로 뜬다 — 팔레트·대화상자·알림. */
  readonly overlays?: ReactNode;
}

/**
 * "앱 진입점" 성격의 최상위 컨테이너 — Header/Sidebar/Content 구조를 Shell 이 직접 조립한다.
 * 예전엔 `Shell.Header`/`Shell.Sidebar`를 소비자가 직접 조립해서 `SplitPageLayout`에 자식으로
 * 넘겼는데, 그러면 `useSlots`가 컴포넌트 참조 동일성으로 슬롯을 골라내는 문제(`asSlot` 우회가
 * 필요했던 이유)가 생겼다 — Shell 이 `SplitPageLayout.Header`/`.Sidebar`/`.Content`를 **자기
 * 내부에서 직접** 만들어 넘기면 `child.type === SplitPageLayout.Header`가 항상 참이라 그 문제
 * 자체가 생기지 않는다.
 *
 * `ThemeProvider` + 포탈 배선(`portalRoot` + `PortalProvider`)도 이 컴포넌트가 흡수한다 — 어떤
 * 앱이 Shell 을 쓰든 똑같이 필요한 순수 구조적 보일러플레이트라, 앱마다 손으로 다시 짜지 않는다.
 *
 * `SplitPageLayout`도 `ThemeProvider`도 forwardRef가 아니라서(둘 다 컴파일된 소스로 확인 —
 * plain 함수), ref는 우리가 직접 렌더하는 wrapper div로 보낸다.
 */
export const Shell = ({
  colorMode,
  isNarrow,
  brand,
  actions,
  sidebars,
  onSidebarSelect,
  onSettingsSelect,
  sidebarTitle,
  sidebarContent,
  sidebarActions,
  onSidebarActionActivate,
  sidebarOpen,
  onSidebarOpenChange,
  sidebarResizable,
  sidebarMinWidth,
  sidebarWidthStorageKey,
  bottoms,
  bottomContent,
  onBottomSelect,
  children,
  overlays,
  className,
  ref,
  ...props
}: ShellProps) => {
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);
  const [uncontrolledSidebarOpen, setUncontrolledSidebarOpen] = useState(false);
  const resolvedSidebarOpen = sidebarOpen ?? uncontrolledSidebarOpen;
  const setSidebarOpen = (next: boolean) => {
    setUncontrolledSidebarOpen(next);
    onSidebarOpenChange?.(next);
  };
  const hasSidebar = sidebars !== undefined;
  const expanded = hasContent(sidebarContent);
  const hasBottom = bottoms !== undefined && bottoms.length > 0;

  return (
    <ThemeProvider colorMode={colorMode}>
      <div
        {...props}
        ref={ref}
        data-component="Shell"
        data-narrow={isNarrow ? "" : undefined}
        className={clsx(className, styles["root"])}
      >
        <PortalProvider container={portalRoot ?? undefined}>
          <SplitPageLayout className={styles["layout"]}>
            <SplitPageLayout.Header padding="none" divider="line">
              <div className={styles["headerRow"]}>
                <span className={styles["headerGroup"]}>
                  {hasSidebar && (
                    <IconButton
                      variant="invisible"
                      size="small"
                      className={styles["sidebarToggle"]}
                      aria-label="사이드바 열기"
                      onClick={() => setSidebarOpen(true)}
                      icon={() => <Icon iconId="layoutSidebarLeft" size="sm" />}
                    />
                  )}
                  {brand}
                </span>
                <span className={styles["headerGroup"]}>{actions}</span>
              </div>
            </SplitPageLayout.Header>
            {hasSidebar && (
              <SplitPageLayout.Sidebar
                padding="none"
                divider="line"
                responsiveVariant="fullscreen"
                width={
                  !expanded
                    ? COLLAPSED_WIDTH
                    : sidebarResizable
                      ? {
                          min: sidebarMinWidth ?? RESIZABLE_DEFAULT_MIN_WIDTH,
                          default: EXPANDED_WIDTH.default,
                          max: RESIZABLE_MAX_WIDTH,
                        }
                      : EXPANDED_WIDTH
                }
                resizable={expanded && sidebarResizable}
                widthStorageKey={sidebarResizable ? sidebarWidthStorageKey : undefined}
                aria-label="사이드바"
                data-component="ShellSidebar"
                className={clsx(styles["sidebar"], resolvedSidebarOpen && styles["sidebarOpen"])}
              >
                <div className={styles["sidebarInner"]} data-state={resolvedSidebarOpen ? "open" : "closed"}>
                  <div className={styles["sidebarCloseButtonRow"]}>
                    <IconButton
                      variant="invisible"
                      size="small"
                      aria-label="사이드바 닫기"
                      onClick={() => setSidebarOpen(false)}
                      icon={() => <Icon iconId="close" size="sm" />}
                    />
                  </div>
                  <div className={styles["sidebarBody"]}>
                    {/* **설정은 아래 묶음의 한 줄이다** — 레일이 따로 그리는 톱니가 아니다.
                        셸은 그 줄을 여기서 만들어 넣고, 고르면 `onSettingsSelect` 로 보낸다. */}
                    <ActivityBar
                      topItems={sidebars}
                      bottomItems={SETTINGS_ROW}
                      onSelect={(id) => (id === SETTINGS_ID ? onSettingsSelect?.() : onSidebarSelect?.(id))}
                    />
                    {expanded && (
                      <Panel
                        density="compact"
                        className={styles["sidebarPanel"]}
                        title={sidebarTitle}
                        actions={
                          sidebarActions !== undefined && sidebarActions.length > 0 ? (
                            <>
                              {sidebarActions.map((action) => (
                                <IconButton
                                  key={action.actionId}
                                  variant="invisible"
                                  size="small"
                                  aria-label={action.label}
                                  onClick={() => onSidebarActionActivate?.(action.actionId)}
                                  icon={() => <Icon iconId={action.iconId} size="sm" />}
                                />
                              ))}
                            </>
                          ) : undefined
                        }
                      >
                        <Container chrome="none" className={styles["sidebarPanelBody"]}>
                          {sidebarContent}
                        </Container>
                      </Panel>
                    )}
                  </div>
                </div>
              </SplitPageLayout.Sidebar>
            )}
            <SplitPageLayout.Content padding="none" className={styles["content"]}>
              <div className={styles["contentFill"]}>
                <div className={styles["main"]}>{children}</div>
                {hasBottom && (
                  <section aria-label="아래 창" data-component="ShellBottom" className={styles["bottom"]}>
                    <div role="tablist" aria-orientation="horizontal" className={styles["bottomStrip"]}>
                      {bottoms.map((bottom) => (
                        <button
                          key={bottom.id}
                          type="button"
                          role="tab"
                          aria-selected={bottom.isActive}
                          data-active={bottom.isActive ? "" : undefined}
                          className={styles["bottomTab"]}
                          onClick={() => onBottomSelect?.(bottom.id)}
                        >
                          <Icon iconId={bottom.iconId} size="sm" />
                          {bottom.title}
                        </button>
                      ))}
                    </div>
                    {hasContent(bottomContent) && (
                      <div role="tabpanel" className={styles["bottomBody"]}>
                        {bottomContent}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </SplitPageLayout.Content>
          </SplitPageLayout>
          {overlays}
        </PortalProvider>
        <div ref={setPortalRoot} className={styles["portalRoot"]} />
      </div>
    </ThemeProvider>
  );
};
