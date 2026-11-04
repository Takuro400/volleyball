import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";

// ルール・写真リンクの更新
export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const update: Record<string, string> = { };
  if (typeof body?.rules === "string") update.rules = body.rules;
  if (typeof body?.photo_link === "string") update.photo_link = body.photo_link.trim();

  // エントリーの受付方法と、Googleフォームのリンク
  if (body?.entry_mode !== undefined) {
    if (body.entry_mode !== "form" && body.entry_mode !== "app") {
      return NextResponse.json({ error: "受付方法が正しくありません" }, { status: 400 });
    }
    update.entry_mode = body.entry_mode;
  }
  for (const key of ["form_team_url", "form_individual_url"] as const) {
    if (body?.[key] === undefined) continue;
    const url = typeof body[key] === "string" ? body[key].trim() : "";
    // 空欄(リンクを外す)か、https のリンクだけ許可
    if (url !== "" && !/^https:\/\/[^\s]+$/.test(url)) {
      return NextResponse.json({ error: "リンクは https:// で始まるものを入力してください" }, { status: 400 });
    }
    update[key] = url;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("settings")
    .upsert({ id: 1, ...update })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
