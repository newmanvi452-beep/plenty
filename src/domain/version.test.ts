import { describe, expect, it } from "vitest";
import { isNewer } from "./version";
describe("isNewer", () => {
  it("compares versions number by number", () => {
    expect(isNewer("1.1.0", "1.0.1")).toBe(true);
    expect(isNewer("1.0.10", "1.0.9")).toBe(true);
    expect(isNewer("2.0", "1.9.9")).toBe(true);
    expect(isNewer("1.0.1", "1.0.1")).toBe(false);
    expect(isNewer("1.0", "1.0.0")).toBe(false);
    expect(isNewer("1.0.0", "1.0.1")).toBe(false);
  });
});
