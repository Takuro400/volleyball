import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { importFormAnswers } from "@/lib/form-import";
import { getAdminSupabase } from "@/lib/supabase/admin";

// Googleフォームの回答を自動で受け取る窓口。スプレッドシートの Apps Script（フォーム送信時）から呼ばれる。
// 秘密のキー(IMPORT_SECRET)を知っている Apps Script だけが使える。
function secretMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.IMPORT_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { status: "error", message: "取り込み用のキー(IMPORT_SECRET)が設定されていません" },
      { status: 503 }
    );
  }
  const given = request.headers.get("x-import-secret") ?? "";
  if (!secretMatches(given, expected)) {
    return NextResponse.json({ status: "error", message: "キーが違います" }, { status: 401 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ status: "error", message: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const answers = body?.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return NextResponse.json({ status: "invalid", message: "回答の形式が正しくありません" }, { status: 400 });
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
    clean[k] = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
  }

  // 結果(満員・重複など)は、状態としてApps Script側に返す。HTTPは常に200（通信自体は成功）
  const result = await importFormAnswers(sb, clean);
  return NextResponse.json(result);
}
