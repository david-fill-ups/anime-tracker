import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { buildOpenApiSpec } from "@/lib/openapi";
import { wrapHandler } from "@/lib/validation";

export async function GET() {
  return wrapHandler(async () => {
    await requireUserId();
    return NextResponse.json(buildOpenApiSpec());
  });
}
