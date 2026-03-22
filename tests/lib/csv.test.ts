import { describe, it, expect } from "vitest";
import { parseCSV, validateHeader, EXPECTED_HEADERS } from "@/lib/csv";

describe("parseCSV", () => {
  it("parses a simple two-column row", () => {
    expect(parseCSV("a,b")).toEqual([["a", "b"]]);
  });

  it("skips blank lines", () => {
    expect(parseCSV("a,b\n\nc,d\n")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles Windows line endings (CRLF)", () => {
    expect(parseCSV("a,b\r\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles quoted fields", () => {
    expect(parseCSV('"hello, world",b')).toEqual([["hello, world", "b"]]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    expect(parseCSV('"say ""hi""",b')).toEqual([['say "hi"', "b"]]);
  });

  it("handles empty fields", () => {
    expect(parseCSV("a,,c")).toEqual([["a", "", "c"]]);
  });

  it("parses multiple rows", () => {
    const result = parseCSV("a,b,c\n1,2,3\n4,5,6");
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(["a", "b", "c"]);
    expect(result[2]).toEqual(["4", "5", "6"]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(parseCSV("   \n   ")).toEqual([]);
  });
});

describe("validateHeader", () => {
  const validHeader = [...EXPECTED_HEADERS];

  it("returns null for a valid header", () => {
    expect(validateHeader(validHeader)).toBeNull();
  });

  it("returns error when column count is too low", () => {
    const result = validateHeader(validHeader.slice(0, 5));
    expect(result).toMatch(/expected 20 columns but found 5/);
  });

  it("returns error when a key column has the wrong name", () => {
    const bad = [...validHeader];
    bad[0] = "Wrong Column";
    const result = validateHeader(bad);
    expect(result).toMatch(/column 1 should be "AniList ID"/);
  });

  it("returns error for wrong column at position 13 (Recommended By)", () => {
    const bad = [...validHeader];
    bad[13] = "Oops";
    const result = validateHeader(bad);
    expect(result).toMatch(/column 14 should be "Recommended By"/);
  });

  it("accepts extra columns beyond the expected count", () => {
    // The validator only checks length >= expected and key positions
    const extended = [...validHeader, "Extra Column"];
    expect(validateHeader(extended)).toBeNull();
  });

  it("trims whitespace when comparing column names", () => {
    const padded = [...validHeader];
    padded[0] = "  AniList ID  ";
    expect(validateHeader(padded)).toBeNull();
  });
});
