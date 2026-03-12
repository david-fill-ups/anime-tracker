import { describe, it, expect, vi } from "vitest";

// Mock db and anilist so the module loads without real connections
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./anilist", () => ({}));

import {
  computeOrder,
  getEntryType,
  entryTypeFromDisplayFormat,
} from "@/lib/franchise-auto";

describe("computeOrder", () => {
  it("returns 999999 when seasonYear is null", () => {
    expect(computeOrder(null, null)).toBe(999999);
    expect(computeOrder(null, "SPRING")).toBe(999999);
  });

  it("uses WINTER offset of 0", () => {
    expect(computeOrder(2023, "WINTER")).toBe(202300);
  });

  it("uses SPRING offset of 3", () => {
    expect(computeOrder(2023, "SPRING")).toBe(202303);
  });

  it("uses SUMMER offset of 6", () => {
    expect(computeOrder(2023, "SUMMER")).toBe(202306);
  });

  it("uses FALL offset of 9", () => {
    expect(computeOrder(2023, "FALL")).toBe(202309);
  });

  it("uses 0 offset for unknown season string", () => {
    expect(computeOrder(2023, "UNKNOWN")).toBe(202300);
  });

  it("uses 0 offset when season is null", () => {
    expect(computeOrder(2023, null)).toBe(202300);
  });

  it("orders earlier years before later ones", () => {
    expect(computeOrder(2020, "FALL")).toBeLessThan(computeOrder(2021, "WINTER"));
  });

  it("orders seasons within the same year correctly", () => {
    const winter = computeOrder(2023, "WINTER");
    const spring = computeOrder(2023, "SPRING");
    const summer = computeOrder(2023, "SUMMER");
    const fall = computeOrder(2023, "FALL");
    expect(winter).toBeLessThan(spring);
    expect(spring).toBeLessThan(summer);
    expect(summer).toBeLessThan(fall);
  });
});

describe("getEntryType", () => {
  it("maps MOVIE to MOVIE", () => {
    expect(getEntryType("MOVIE")).toBe("MOVIE");
  });

  it("maps OVA to OVA", () => {
    expect(getEntryType("OVA")).toBe("OVA");
  });

  it("maps SPECIAL to OVA", () => {
    expect(getEntryType("SPECIAL")).toBe("OVA");
  });

  it.each(["TV", "TV_SHORT", "ONA", "MUSIC"] as const)(
    "maps %s to MAIN",
    (format) => {
      expect(getEntryType(format)).toBe("MAIN");
    }
  );
});

describe("entryTypeFromDisplayFormat", () => {
  it("maps MOVIE to MOVIE", () => {
    expect(entryTypeFromDisplayFormat("MOVIE")).toBe("MOVIE");
  });

  it("maps SERIES to MAIN", () => {
    expect(entryTypeFromDisplayFormat("SERIES")).toBe("MAIN");
  });
});
