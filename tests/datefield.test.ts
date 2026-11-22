import { describe, expect, it } from "vitest";
import { dmyToIso, isoToDmy, maskDmy } from "@/components/DateField";

describe("кун.ой.йил сана", () => {
  it("ISO ни кун.ой.йил га ўгиради", () => {
    expect(isoToDmy("2026-11-22")).toBe("22.11.2026");
    expect(isoToDmy("")).toBe("");
  });
  it("кун.ой.йил ни ISO га ўгиради ва нотўғрисини рад этади", () => {
    expect(dmyToIso("22.11.2026")).toBe("2026-11-22");
    expect(dmyToIso("31.02.2026")).toBeNull();
    expect(dmyToIso("2026-11-22")).toBeNull();
  });
  it("ёзилаётган рақамларга нуқта қўяди", () => {
    expect(maskDmy("2211")).toBe("22.11");
    expect(maskDmy("22112026")).toBe("22.11.2026");
    expect(maskDmy("22.11.20267")).toBe("22.11.2026");
  });
});
