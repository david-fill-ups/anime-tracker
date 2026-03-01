import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export async function DELETE() {
  const userId = await requireUserId();

  // Deleting the user cascades to: UserEntry, Franchise, Person, Account, Session
  await db.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
