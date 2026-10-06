import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Member } from "@/lib/types";

// 開発環境限定: 動作確認用のダミーデータ投入 / 全データリセット
function devGuard() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "この機能は開発環境専用です" }, { status: 403 });
  }
  return null;
}

const FAMILY = ["田中", "佐藤", "鈴木", "高橋", "伊藤", "渡辺", "山本", "中村", "小林", "加藤"];
const GIVEN = ["太郎", "健太", "大輝", "翔", "陸", "蓮", "湊", "颯太", "悠人", "陽翔"];

export async function POST() {
  const blocked = devGuard();
  if (blocked) return blocked;
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const rows = Array.from({ length: 20 }, (_, i) => {
    const members: Member[] = Array.from({ length: 4 }, (_, j) => ({
      name: `${FAMILY[(i + j * 3) % FAMILY.length]}${GIVEN[(i * 2 + j) % GIVEN.length]}`,
      isLeader: j === 0,
    }));
    return {
      name: `ダミーチーム${String(i + 1).padStart(2, "0")}`,
      block: null,
      members,
    };
  });

  const { error } = await sb.from("teams").insert(rows);
  if (error) {
    return NextResponse.json({ error: "ダミーデータの投入に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE() {
  const blocked = devGuard();
  if (blocked) return blocked;
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  // teams を削除すると matches は外部キーの cascade で消える
  const { error: matchError } = await sb.from("matches").delete().gte("created_at", "1970-01-01");
  const { error: teamError } = await sb.from("teams").delete().gte("created_at", "1970-01-01");
  if (matchError || teamError) {
    return NextResponse.json({ error: "リセットに失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
