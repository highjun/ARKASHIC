import { useViewModel } from "#core/viewmodel";
import { observer } from "mobx-react-lite";
import { Heading } from "@primer/react";
import { Text } from "#component/Text";
import { KeybindingTable } from "../component/KeybindingTable";
import type { SettingsRow } from "../viewmodel/ISettingsViewModel";
import styles from "./SettingsTabView.module.css";

/** 줄의 `type`마다 입력이 다르다 — 스위치·숫자·글·라디오. */
const SettingsInput = observer(function SettingsInput({
  row,
  onChange,
}: {
  readonly row: SettingsRow;
  readonly onChange: (value: unknown) => void;
}) {
  switch (row.type) {
    case "boolean":
      return (
        <label className={styles["option"]}>
          <input type="checkbox" checked={row.value === true} onChange={(event) => onChange(event.target.checked)} />
          <Text>{row.title}</Text>
        </label>
      );
    case "number":
      return (
        <label className={styles["option"]}>
          <Text>{row.title}</Text>
          <input
            type="number"
            value={typeof row.value === "number" ? row.value : ""}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </label>
      );
    case "string":
      return (
        <label className={styles["option"]}>
          <Text>{row.title}</Text>
          <input
            type="text"
            value={typeof row.value === "string" ? row.value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      );
    case "enum":
      return (
        <fieldset className={styles["options"]}>
          <legend className={styles["legend"]}>{row.title}</legend>
          {(row.options ?? []).map((option) => (
            <label key={option} className={styles["option"]}>
              <input
                type="radio"
                name={row.id}
                value={option}
                checked={row.value === option}
                onChange={() => onChange(option)}
              />
              <Text>{option}</Text>
            </label>
          ))}
        </fieldset>
      );
  }
});

/**
 * 설정 탭. 등록된 스키마를 줄로 편다 — 키가 늘면 줄이 는다. 밝기는 여기 없다 — 헤더의 토글이 바꾼다.
 *
 * **단축키도 여기 한 범주다.** 제 화면을 갖지 않는다 — 바꾸는 자리가 여럿이면 어디서 바꾸는지를
 * 사용자가 기억해야 한다.
 */
export const SettingsTabView = observer(function SettingsTabView() {
  const viewModel = useViewModel("arka.workbench.settingsViewModel");
  const keybindings = useViewModel("arka.workbench.keybindingViewModel");
  return (
    <div data-component="SettingsTabView" className={styles["root"]}>
      {viewModel.rows.map((row) => (
        <section key={row.id} className={styles["section"]}>
          <Heading as="h2" variant="medium">
            {row.title}
          </Heading>
          <SettingsInput row={row} onChange={(value) => viewModel.set(row.id, value)} />
        </section>
      ))}
      <section className={styles["section"]}>
        <Heading as="h2" variant="medium">
          단축키
        </Heading>
        <KeybindingTable rows={keybindings.rows} />
      </section>
    </div>
  );
});
