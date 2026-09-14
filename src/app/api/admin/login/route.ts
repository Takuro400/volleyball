import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  hashPassphrase,
  isAdminConfigured,
  isAdminRequest,
} from "@/lib/admin-auth";

export async function GET() {
  return NextResponse.json({
    admin: await isAdminRequest(),
    configured: isAdminConfigured(),
  });
}

export async function POST(request: Request) {
  const passphrase = process.env.ADMIN_PASSPHRASE;
  if (!passphrase) {
    return NextResponse.json(
      { error: "運営モードが設定されていません（ADMIN_PASSPHRASE 未設定）" },
      { status: 500 }
    );
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body.passphrase !== "string" || body.passphrase !== passphrase) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, hashPassphrase(passphrase), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ admin: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return NextResponse.json({ admin: false });
}
