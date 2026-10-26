import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Member } from "@/lib/types";

// 運営用: 個人エントリーのチーム分けを確定する。
// 画面でランダムに分けた結果（チーム名と、各チームに入る人のID）を受け取り、
// チーム(kind=guerrilla)を作って、個人エントリーをそのチームに紐づける。
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "運営モードでログインしてください" }, { status: 403 });
  }
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const input: unknown = body?.teams;
  if (!Array.isArray(input) || input.length < 1 || input.length > 10) {
    return NextResponse.json({ error: "チーム分けの内容が正しくありません" }, { status: 400 });
  }

  type TeamInput = { name: string; ids: string[] };
  const teamsInput: TeamInput[] = [];
  const used = new Set<string>();
  for (const t of input) {
    const name = typeof t?.name === "string" ? t.name.trim() : "";
    const ids: unknown = t?.ids;
    if (!name || name.length > 30) {
      return NextResponse.json({ error: "チーム名は1〜30文字で入力してください" }, { status: 400 });
    }
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 15 || ids.some((i) => typeof i !== "string")) {
      return NextResponse.json({ error: "各チームの人数が正しくありません" }, { status: 400 });
    }
    for (const id of ids as string[]) {
      if (used.has(id)) {
        return NextResponse.json({ error: "同じ人が複数のチームに入っています" }, { status: 400 });
      }
      used.add(id);
    }
    teamsInput.push({ name, ids: ids as string[] });
  }

  // 既にリーグ戦が組まれていると、新しいチームが組み込めないので止める
  const { count: matchCount, error: matchError } = await sb
    .from("matches")
    .select("id", { count: "exact", head: true });
  if (matchError) {
    return NextResponse.json({ error: "試合の確認に失敗しました" }, { status: 500 });
  }
  if ((matchCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "既に試合が組まれています。チーム分けは、ブロック割当・リーグ戦の生成より前に行ってください" },
      { status: 409 }
    );
  }

  type Row = { id: string; name: string; group_id: string; team_id: string | null };
  const { data: all, error: readError } = await sb
    .from("individuals")
    .select("id, name, group_id, team_id");
  if (readError) {
    return NextResponse.json({ error: "個人エントリーの取得に失敗しました" }, { status: 500 });
  }
  const rows = (all ?? []) as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of used) {
    const r = byId.get(id);
    if (!r) {
      return NextResponse.json({ error: "取り消された個人エントリーが含まれています。画面を更新してください" }, { status: 409 });
    }
    if (r.team_id) {
      return NextResponse.json({ error: "既にチームに編成されている人が含まれています。画面を更新してください" }, { status: 409 });
    }
  }

  // 一緒にエントリーした人（同じグループ）は、必ず同じチームにする。
  // グループの未編成メンバー全員が、選ばれていて、かつ同じチームに入っていること。
  const teamOf = new Map<string, number>();
  teamsInput.forEach((t, i) => t.ids.forEach((id) => teamOf.set(id, i)));
  const groupIds = new Set([...used].map((id) => (byId.get(id) as Row).group_id));
  for (const gid of groupIds) {
    const members = rows.filter((r) => r.group_id === gid && !r.team_id);
    const teams = new Set(members.map((m) => teamOf.get(m.id)));
    if (teams.has(undefined)) {
      return NextResponse.json(
        { error: "一緒にエントリーした人の一部だけがチーム分けに含まれています。全員を同じチームに入れてください" },
        { status: 400 }
      );
    }
    if (teams.size > 1) {
      return NextResponse.json(
        { error: "一緒にエントリーした人が別々のチームに分かれています。同じチームにしてください" },
        { status: 400 }
      );
    }
  }

  // チームを作り、個人エントリーを紐づける。途中で失敗したら作ったチームを消して元に戻す。
  const createdTeamIds: string[] = [];
  const rollback = async () => {
    for (const id of createdTeamIds) await sb.from("teams").delete().eq("id", id);
  };
  for (const t of teamsInput) {
    const members: Member[] = t.ids.map((id, i) => ({
      name: (byId.get(id) as { name: string }).name,
      isLeader: i === 0, // 先頭の人を仮のリーダーにする
    }));
    const { data: team, error } = await sb
      .from("teams")
      .insert({ name: t.name, block: null, members, kind: "guerrilla" })
      .select("id")
      .single();
    if (error || !team) {
      await rollback();
      return NextResponse.json(
        { error: "チームの作成に失敗しました。Supabase で最新の追加SQLを実行してください" },
        { status: 500 }
      );
    }
    createdTeamIds.push(team.id as string);
    const { error: linkError } = await sb
      .from("individuals")
      .update({ team_id: team.id })
      .in("id", t.ids);
    if (linkError) {
      await rollback();
      return NextResponse.json({ error: "個人エントリーの紐づけに失敗しました" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, teams: createdTeamIds.length, people: used.size });
}
