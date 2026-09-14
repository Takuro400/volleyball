import { cookies } from "next/headers";
import { createHash } from "crypto";

// 簡易的な運営者モード。合言葉のハッシュを httpOnly Cookie に保存する。
// 将来 Supabase Auth に置き換える場合は isAdminRequest の実装だけ差し替えればよい。
export const ADMIN_COOKIE = "volley_admin";

export function hashPassphrase(passphrase: string): string {
  return createHash("sha256").update(`volley:${passphrase}`).digest("hex");
}

export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_PASSPHRASE;
}

export async function isAdminRequest(): Promise<boolean> {
  const passphrase = process.env.ADMIN_PASSPHRASE;
  if (!passphrase) return false;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === hashPassphrase(passphrase);
}
