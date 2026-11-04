import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { createIndividualEntry, getEntryMode } from "@/lib/entry-core";
import { getAdminSupabase } from "@/lib/supabase/admin";

// 当日チーム分け（1〜3人）エントリー（アプリ内のフォーム）。
// 一緒にエントリーした人は同じグループとして記録し、当日のチーム分けで必ず同じチームにする。
// 名前・性別・経験者の別は運営だけが見られる（一般には人数のみ公開）。
// 受付方法が「Googleフォーム」のときは、運営(ログイン済み)だけが当日の手入力などに使える。
export async function POST(request: Request) {
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }
  if ((await getEntryMode(sb)) !== "app" && !(await isAdminRequest())) {
    return NextResponse.json(
      { error: "エントリーは Google フォームから受け付けています", closed: true },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const result = await createIndividualEntry(sb, { people: body?.people });
  if (!result.ok) {
    return NextResponse.json({ error: result.message, ...result.extra }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
