import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { clsx } from "clsx";
import styles from "./ActivityBar.module.css";
import { Container } from "#component/Container";
import { Icon } from "#component/Icon";
import { IconButton } from "#component/IconButton";
import { Menu } from "#component/Menu";
import type { IconId } from "#component/Icon";

/** 레일에 그릴 한 줄 — `workbench/viewmodel`의 `SidebarRow`와 구조가 같다(부품은 그 층을 못 본다). */
export interface SidebarRow {
  readonly id: string;
  readonly title: string;
  readonly iconId: IconId;
  readonly isActive: boolean;
}

/** `onSelect`를 가로챈다 — 표준 `onSelect`가 아니라 항목 선택이다. */
export interface ActivityBarProps extends Omit<ComponentPropsWithoutRef<"nav">, "onSelect"> {
  /** 루트 원소로 그대로 통과한다. */
  readonly ref?: Ref<HTMLElement>;
  /** 위 묶음 — 기능들. 넘치면 여기만 스크롤된다. */
  readonly topItems: readonly SidebarRow[];
  /** 아래 묶음 — 계정·설정. 위가 넘쳐도 밀리지 않는다. */
  readonly bottomItems?: readonly SidebarRow[];
  /** 어느 묶음이든 항목을 클릭하면 그 id와 함께 호출된다. */
  readonly onSelect?: (id: string) => void;
  /** 주어지면 아이콘이 우클릭에 반응해 이 결과를 `Menu.Content`로 띄운다 — 없으면 아무 일도 없다(옵트인). */
  readonly renderItemMenu?: (item: SidebarRow) => ReactNode;
}

/**
 * VSCode의 활동 표시줄(Activity Bar) — 사이드바를 고르는 세로 아이콘 줄. `Sidebar`(도킹 패널)와는
 * 별개의 개념이라 독립 컴포넌트다.
 *
 * **위와 아래는 완전히 별개다.** 한 목록에 여백을 끼워 가른 것이 아니라 묶음이 둘이고, 사이를
 * 늘어나는 빈 칸이 민다. 그래서 위가 넘쳐 스크롤이 생겨도 아래 묶음은 제자리에 남는다.
 *
 * `nav`는 순수 시맨틱 래퍼로만 남는다 — 실제 스크롤은 안쪽 `Container`가 맡는다. 아이콘들의
 * flex 배치(`.rail`)는 `Container`의 `className`이 아니라 children 안쪽에 있어야 한다 —
 * `Container`의 `className`은 바깥 chrome 박스에 붙지, 스크롤되는 Viewport 안 배치까지 건드리지 않는다.
 */
export const ActivityBar = ({
  topItems,
  bottomItems,
  onSelect,
  renderItemMenu,
  className,
  ref,
  ...props
}: ActivityBarProps) => {
  const 줄 = (item: SidebarRow) => {
    const button = (
      <IconButton
        key={item.id}
        variant={item.isActive ? "default" : "invisible"}
        size="medium"
        aria-label={item.title}
        aria-pressed={item.isActive}
        onClick={() => onSelect?.(item.id)}
        icon={() => <Icon iconId={item.iconId} size="lg" />}
      />
    );

    return renderItemMenu ? (
      <Menu kind="context" key={item.id}>
        <Menu.Trigger className={styles["itemContextMenuTrigger"]}>{button}</Menu.Trigger>
        <Menu.Content>{renderItemMenu(item)}</Menu.Content>
      </Menu>
    ) : (
      button
    );
  };

  return (
    <nav ref={ref} {...props} data-component="ActivityBar" className={clsx(className, styles["nav"])}>
      <Container chrome="none" className={styles["container"]}>
        <div className={styles["rail"]}>{topItems.map(줄)}</div>
      </Container>
      {bottomItems === undefined || bottomItems.length === 0 ? null : (
        <div className={styles["bottom"]}>{bottomItems.map(줄)}</div>
      )}
    </nav>
  );
};
