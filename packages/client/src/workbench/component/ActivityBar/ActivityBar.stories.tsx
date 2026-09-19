import type { Meta, StoryObj } from "@storybook/react-vite";
import { Menu } from "#component/Menu";
import { ActivityBar } from "./index";
import type { SidebarRow } from "./index";

const TOP: readonly SidebarRow[] = [
  { id: "files", iconId: "files", title: "탐색기", isActive: true },
  { id: "search", iconId: "search", title: "검색", isActive: false },
  { id: "sourceControl", iconId: "sourceControl", title: "소스 제어", isActive: false },
  { id: "agent", iconId: "brain", title: "에이전트", isActive: false },
];

/** 아래 묶음 — 계정과 설정. 위가 넘쳐도 밀리지 않는다. */
const BOTTOM: readonly SidebarRow[] = [
  { id: "account", iconId: "account", title: "계정", isActive: false },
  { id: "settings", iconId: "settingsGear", title: "설정", isActive: false },
];

const meta = {
  title: "01-workbench/ActivityBar",
  component: ActivityBar,
  args: { topItems: TOP, bottomItems: BOTTOM, onSelect: () => undefined },
  decorators: [
    (Story) => (
      <div style={{ height: 480, width: 48 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** 위가 비어도 아래 묶음은 남는다 — 둘은 별개다. */
export const Empty: Story = { args: { topItems: [] } };
/** 아래 묶음이 없으면 그 자리도 안 잡는다. */
export const TopOnly: Story = { args: { bottomItems: undefined } };
export const NoneActive: Story = { args: { topItems: TOP.map((item) => ({ ...item, isActive: false })) } };
export const WithItemMenu: Story = {
  args: {
    renderItemMenu: (item) => <Menu.Item onSelect={() => undefined}>{item.title} 숨기기</Menu.Item>,
  },
};
