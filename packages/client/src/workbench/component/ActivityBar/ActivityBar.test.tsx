import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  implementsClassName,
  implementsDataComponent,
  implementsRef,
  implementsNoA11yViolations,
} from "#utils/testing";
import { ActivityBar } from "./ActivityBar";
import type { SidebarRow } from "./ActivityBar";

const TOP: SidebarRow[] = [
  { id: "explorer", iconId: "files", title: "탐색기", isActive: true },
  { id: "search", iconId: "search", title: "검색", isActive: false },
];

const BOTTOM: SidebarRow[] = [{ id: "settings", iconId: "settingsGear", title: "설정", isActive: false }];

describe("ActivityBar", () => {
  it("클릭 시 onSelect 가 그 id 로 호출된다", () => {
    const onSelect = vi.fn();
    render(<ActivityBar topItems={TOP} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "검색" }));

    expect(onSelect).toHaveBeenCalledWith("search");
  });

  it("활성 여부는 줄이 정한다 — aria-pressed 로 드러난다", () => {
    render(<ActivityBar topItems={TOP} />);

    expect(screen.getByRole("button", { name: "탐색기" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "검색" })).toHaveAttribute("aria-pressed", "false");
  });

  it("아래 묶음도 같은 onSelect 로 간다 — 위와 아래를 가르는 것은 자리지 통로가 아니다", () => {
    const onSelect = vi.fn();
    render(<ActivityBar topItems={TOP} bottomItems={BOTTOM} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "설정" }));

    expect(onSelect).toHaveBeenCalledWith("settings");
  });

  it("아래 묶음이 없으면 그 자리도 안 잡는다", () => {
    render(<ActivityBar topItems={TOP} />);

    expect(screen.queryByRole("button", { name: "설정" })).toBeNull();
  });

  it("renderItemMenu 를 주면 우클릭에 그 메뉴가 뜬다", () => {
    render(<ActivityBar topItems={TOP} renderItemMenu={(item) => <span>{item.title} 숨기기</span>} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: "검색" }));

    expect(screen.getByText("검색 숨기기")).toBeInTheDocument();
  });

  implementsDataComponent((extra) => <ActivityBar topItems={TOP} bottomItems={BOTTOM} {...extra} />, "ActivityBar");
  implementsClassName((extra) => <ActivityBar topItems={TOP} bottomItems={BOTTOM} {...extra} />);
  implementsRef((extra) => <ActivityBar topItems={TOP} bottomItems={BOTTOM} {...extra} />, HTMLElement);
  implementsNoA11yViolations(() => <ActivityBar topItems={TOP} bottomItems={BOTTOM} />);
});
