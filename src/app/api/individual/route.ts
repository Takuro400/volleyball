import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { INDIVIDUAL_LIMIT, MAX_GROUP_SIZE, isGender } from "@/lib/types";

// 当日チーム分け（1〜3人）エントリー（一般ユーザーも可）。
// 一緒にエントリーした人は同じグループとして記録し、当日のチーム分けで必ず同じチームにする。
// 名前・性別・経験者の別は運営だけが見られる（一般には人数のみ公開）。
export async function POST(request: Request) {
  const sb = getAdminSupabase();
  if (!sb) {
    return NextResponse.json({ error: "サーバーの設定が完了していません" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const rawPeople: unknown[] = Array.isArray(body?.people) ? body.people : [];
  if (rawPeople.length < 1 || rawPeople.length > MAX_GROUP_SIZE) {
    return NextResponse.json(
      { error: `一緒にエントリーできるのは1〜${MAX_GROUP_SIZE}人です` },
      { status: 400 }
    );
  }

  const people: { name: string; gender: string; experienced: boolean }[] = [];
  for (const p of rawPeople as Record<string, unknown>[]) {
    const name = typeof p?.name === "string" ? p.name.trim() : "";
    if (!name || name.length > 30) {
      return NextResponse.json(
        { error: "全員の名前を30文字以内で入力してください" },
        { status: 400 }
      );
    }
    if (!isGender(p?.gender)) {
      return NextResponse.json({ error: "全員の性別を選択してください" }, { status: 400 });
    }
    people.push({ name, gender: p.gender as string, experienced: p?.experienced === true });
  }
  if (new Set(people.map((p) => p.name)).size !== people.length) {
    return NextResponse.json(
      { error: "同じ名前の人が含まれています。別の方の場合は、名前の後ろに学科などを付けてください" },
      { status: 400 }
    );
  }

  const { data: existing, error: listError } = await sb.from("individuals").select("name");
  if (listError) {
    return NextResponse.json(
      { error: "現在、個人エントリーを受け付けられません。運営にお知らせください" },
      { status: 500 }
    );
  }
  const names = new Set(((existing ?? []) as { name: string }[]).map((n) => n.name));
  const taken = (existing ?? []).length;

  if (taken + people.length > INDIVIDUAL_LIMIT) {
    const left = Math.max(0, INDIVIDUAL_LIMIT - taken);
    return NextResponse.json(
      {
        error:
          left === 0
            ? `個人エントリーは${INDIVIDUAL_LIMIT}人で締め切りました`
            : `個人エントリーは残り${left}人分です。${people.length}人ではエントリーできません`,
        full: left === 0,
        left,
      },
      { status: 409 }
    );
  }
  // 二重送信の防止。同姓同名の別の方は、名前の後ろに学科などを付けてもらう
  const dup = people.find((p) => names.has(p.name));
  if (dup) {
    return NextResponse.json(
      {
        error: `「${dup.name}」さんは既に登録されています。別の方の場合は、名前の後ろに学科などを付けてください（例: 田中太郎(電気)）`,
        duplicate: true,
      },
      { status: 409 }
    );
  }

  const groupId = randomUUID();
  const { error } = await sb
    .from("individuals")
    .insert(people.map((p) => ({ ...p, group_id: groupId })));
  if (error) {
    return NextResponse.json({ error: "登録に失敗しました" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: taken + people.length });
}
