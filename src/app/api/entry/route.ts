import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isDept, type Member } from "@/lib/types";

// チームエントリー（一般ユーザーも可）
export async function POST(request: Request) {
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "サーバーの設定が完了していません" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawMembers = Array.isArray(body?.members) ? body.members : [];

  if (!name) {
    return NextResponse.json({ error: "チーム名を入力してください" }, { status: 400 });
  }
  if (name.length > 30) {
    return NextResponse.json({ error: "チーム名は30文字以内にしてください" }, { status: 400 });
  }
  if (rawMembers.length < 1 || rawMembers.length > 15) {
    return NextResponse.json({ error: "メンバーは1〜15人で入力してください" }, { status: 400 });
  }

  const members: Member[] = [];
  for (const m of rawMembers) {
    const memberName = typeof m?.name === "string" ? m.name.trim() : "";
    if (!memberName || memberName.length > 30) {
      return NextResponse.json(
        { error: "メンバー全員の名前を30文字以内で入力してください" },
        { status: 400 }
      );
    }
    if (!isDept(m?.dept)) {
      return NextResponse.json(
        { error: "所属学科を選択してください" },
        { status: 400 }
      );
    }
    members.push({ name: memberName, dept: m.dept, isLeader: m?.isLeader === true });
  }
  if (members.filter((m) => m.isLeader).length !== 1) {
    return NextResponse.json(
      { error: "リーダーを1人選択してください" },
      { status: 400 }
    );
  }

  const { data, error } = await sb
    .from("teams")
    .insert({ name, block: null, members })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ team: data });
}
