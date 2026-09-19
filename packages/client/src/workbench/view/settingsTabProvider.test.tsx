import { URI } from "#contracts";
import { describe, expect, it } from "vitest";
import { settingsTabProvider } from "./settingsTabProvider";

describe("설정 탭 provider", () => {
  it("arka:///settings만 받는다", async () => {
    await expect(settingsTabProvider.openTab(URI.parse("arka:///settings"))).resolves.toMatchObject({ title: "설정" });
    await expect(settingsTabProvider.openTab(URI.parse("arka:///something-else"))).resolves.toBeUndefined();
    await expect(settingsTabProvider.openTab(URI.file("settings"))).resolves.toBeUndefined();
  });
});
