import { describe, expect, it } from "vitest";
import { displayTitle, hasPrayerItemContent } from "./prayer-item.js";

describe("hasPrayerItemContent", () => {
  it("제목만 있어도 내용이 있다", () => {
    expect(hasPrayerItemContent({ title: "취업", detail: null })).toBe(true);
  });

  it("상세만 있어도 내용이 있다", () => {
    expect(hasPrayerItemContent({ title: null, detail: "요즘 마음이 지쳐 있다" })).toBe(true);
  });

  it("제목과 상세가 모두 비어 있으면 내용이 없다", () => {
    expect(hasPrayerItemContent({ title: "  ", detail: "\n" })).toBe(false);
    expect(hasPrayerItemContent({ title: null, detail: null })).toBe(false);
  });
});

describe("displayTitle", () => {
  it("제목이 있으면 제목을 보여 준다", () => {
    expect(displayTitle({ title: " 어머니 건강 ", detail: "검사 결과" })).toBe("어머니 건강");
  });

  it("제목이 없으면 상세의 첫 줄을 보여 준다", () => {
    expect(displayTitle({ title: null, detail: "  검사 결과가 다음 주에 나온다\n결과보다…" })).toBe(
      "검사 결과가 다음 주에 나온다",
    );
  });
});
