import { describe, it, expect, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { requireUserId } from "@/lib/auth-helpers";

const mockAuth = auth as ReturnType<typeof vi.fn>;

describe("requireUserId", () => {
  it("returns userId when session is valid", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user-123" } });
    const id = await requireUserId();
    expect(id).toBe("user-123");
  });

  it("throws a 401 Response when session is null", async () => {
    mockAuth.mockResolvedValueOnce(null);
    let thrown: unknown;
    try {
      await requireUserId();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });

  it("throws a 401 Response when user.id is missing", async () => {
    mockAuth.mockResolvedValueOnce({ user: {} });
    let thrown: unknown;
    try {
      await requireUserId();
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });
});
