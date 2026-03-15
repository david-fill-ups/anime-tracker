import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { wrapHandler } from "@/lib/validation";

describe("wrapHandler", () => {
  it("returns the handler's response on success", async () => {
    const res = NextResponse.json({ ok: true });
    const response = await wrapHandler(async () => res);
    expect(response).toBe(res);
  });

  it("returns 500 when handler throws an Error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await wrapHandler(async () => {
      throw new Error("boom");
    });
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
    consoleSpy.mockRestore();
  });

  it("propagates thrown Response objects (e.g., 401 from requireUserId)", async () => {
    const authError = Response.json({ error: "Unauthorized" }, { status: 401 });
    const response = await wrapHandler(async () => {
      throw authError;
    });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("propagates a 403 thrown Response", async () => {
    const response = await wrapHandler(async () => {
      throw Response.json({ error: "Forbidden" }, { status: 403 });
    });
    expect(response.status).toBe(403);
  });
});
