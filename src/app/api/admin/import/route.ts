import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { importFormAnswers, type ImportResult } from "@/lib/form-import";
import { getAdminSupabase } from "@/lib/supabase/admin";

// 運営用: スプレッドシートから貼り付けた回答を、まとめてアプリに取り込む（自動反映の予備）。
// 既に登録済みの名前は「重複」として飛ばすので、同じ表を何度貼り付けても二重登録にならない。
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const rows: unknown = body?.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
    return NextResponse.json({ error: "取り込む行が正しくありません（1〜200行）" }, { status: 400 });
  }

  const results: ImportResult[] = [];
  for (const row of rows as Record<string, unknown>[]) {
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(row ?? {})) answers[k] = String(v ?? "");
    results.push(await importFormAnswers(sb, answers));
  }
  const count = (s: string) => results.filter((r) => r.status === s).length;
  return NextResponse.json({
    results,
    summary: {
      accepted: count("accepted"),
      full: count("full"),
      duplicate: count("duplicate"),
      invalid: count("invalid"),
      error: count("error"),
    },
  });
}
