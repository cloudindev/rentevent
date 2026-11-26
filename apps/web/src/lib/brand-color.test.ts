import { describe, expect, it } from "vitest";
import { brandAccent } from "./brand-color";

describe("brandAccent", () => {
  it("rejects invalid colours", () => {
    expect(brandAccent(null)).toBeNull();
    expect(brandAccent("")).toBeNull();
    expect(brandAccent("red")).toBeNull();
    expect(brandAccent("#fff")).toBeNull();
    expect(brandAccent("#12345g")).toBeNull();
  });
  it("puts white text on dark colours and dark text on light ones", () => {
    expect(brandAccent("#000000")?.fg).toBe("#ffffff");
    expect(brandAccent("#1E3A8A")?.fg).toBe("#ffffff");
    expect(brandAccent("#FFFFFF")?.fg).toBe("#111111");
    expect(brandAccent("#FACC15")?.fg).toBe("#111111");
  });
  it("keeps the colour as given", () => {
    expect(brandAccent("#F95F40")?.bg).toBe("#F95F40");
  });
});
