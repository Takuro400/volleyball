import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { normalizeName } from "./names";
import {
  INDIVIDUAL_LIMIT,
  MAX_GROUP_SIZE,
  TEAM_ENTRY_LIMIT,
  isGender,
  type EntryMode,
  type Member,
} from "./types";

// エントリー登録の共通処理（サーバー専用）。
// アプリ内のフォーム・Googleフォームからの自動反映・運営の取り込みのすべてが、同じ上限・重複・名前チェックを通る。

export type EntryResult =
  | { ok: true; message: string; kind: "team" | "individual"; team?: unknown }
  | {
      ok: false;
      status: number;
      // full=満員 / duplicate=重複 / invalid=入力が不正 / error=サーバーの問題
      code: "full" | "duplicate" | "invalid" | "error";
      message: string;
      extra?: Record<string, unknown>;
    };

const invalid = (message: string): EntryResult => ({ ok: false, status: 400, code: "invalid", message });

// アプリ内のエントリーフォームを開いているか。列が無い・読めないときは閉じる側（いたずら防止）。
export async function getEntryMode(sb: SupabaseClient): Promise<EntryMode> {
  const { data, error } = await sb.from("settings").select("entry_mode").eq("id", 1).maybeSingle();
  if (error) return "form";
  return (data as { entry_mode?: string } | null)?.entry_mode === "app" ? "app" : "form";
}

export async function createTeamEntry(
  sb: SupabaseClient,
  input: { name: unknown; members: unknown }
): Promise<EntryResult> {
  const name = normalizeName(input.name);
  if (!name.ok) return invalid(`チーム名: ${name.reason}`);
  const raw = Array.isArray(input.members) ? input.members : [];
  if (raw.length < 1 || raw.length > 15) return invalid("メンバーは1〜15人で入力してください");

  const members: Member[] = [];
  for (const m of raw as Record<string, unknown>[]) {
    const n = normalizeName(m?.name);
    if (!n.ok) return invalid(`メンバーの名前: ${n.reason}`);
    members.push({ name: n.value, isLeader: m?.isLeader === true });
  }
  if (members.filter((m) => m.isLeader).length !== 1) return invalid("リーダーを1人選択してください");

  const { data: existing, error: listError } = await sb.from("teams").select("name, kind");
  if (listError) {
    // 追加列(kind)が無いデータベースでは、チーム名だけで確認する
    const { data: names, error: namesError } = await sb.from("teams").select("name");
    if (namesError) return { ok: false, status: 500, code: "error", message: "現在、登録を受け付けられません" };
    if ((names as { name: string }[]).some((t) => t.name === name.value)) {
      return {
        ok: false,
        status: 409,
        code: "duplicate",
        message: `「${name.value}」は既に登録されています。別のチーム名にしてください`,
      };
    }
  } else {
    const rows = (existing ?? []) as { name: string; kind?: string }[];
    if (rows.some((t) => t.name === name.value)) {
      return {
        ok: false,
        status: 409,
        code: "duplicate",
        message: `「${name.value}」は既に登録されています。別のチーム名にしてください`,
      };
    }
    // チームでのエントリーは15チームまで（残りは当日チーム分けのエントリーから編成する）
    const entries = rows.filter((t) => (t.kind ?? "entry") === "entry").length;
    if (entries >= TEAM_ENTRY_LIMIT) {
      return {
        ok: false,
        status: 409,
        code: "full",
        message: `チームでのエントリーは${TEAM_ENTRY_LIMIT}チームで締め切りました`,
        extra: { full: true },
      };
    }
  }

  const { data, error } = await sb
    .from("teams")
    .insert({ name: name.value, block: null, members })
    .select()
    .single();
  if (error) return { ok: false, status: 500, code: "error", message: "登録に失敗しました" };
  return { ok: true, kind: "team", message: `「${name.value}」を登録しました`, team: data };
}

export async function createIndividualEntry(
  sb: SupabaseClient,
  input: { people: unknown }
): Promise<EntryResult> {
  const raw = Array.isArray(input.people) ? input.people : [];
  if (raw.length < 1 || raw.length > MAX_GROUP_SIZE) {
    return invalid(`一緒にエントリーできるのは1〜${MAX_GROUP_SIZE}人です`);
  }

  const people: { name: string; gender: string; experienced: boolean }[] = [];
  for (const p of raw as Record<string, unknown>[]) {
    const n = normalizeName(p?.name);
    if (!n.ok) return invalid(`名前: ${n.reason}`);
    if (!isGender(p?.gender)) return invalid("全員の性別を選択してください");
    people.push({ name: n.value, gender: p.gender as string, experienced: p?.experienced === true });
  }
  if (new Set(people.map((p) => p.name)).size !== people.length) {
    return invalid("同じ名前の人が含まれています。別の方の場合は、名前の後ろに学科などを付けてください");
  }

  const { data: existing, error: listError } = await sb.from("individuals").select("name");
  if (listError) {
    return { ok: false, status: 500, code: "error", message: "現在、当日チーム分けのエントリーを受け付けられません" };
  }
  const names = new Set(((existing ?? []) as { name: string }[]).map((n) => n.name));
  const taken = (existing ?? []).length;

  if (taken + people.length > INDIVIDUAL_LIMIT) {
    const left = Math.max(0, INDIVIDUAL_LIMIT - taken);
    return {
      ok: false,
      status: 409,
      code: "full",
      message:
        left === 0
          ? `当日チーム分けのエントリーは${INDIVIDUAL_LIMIT}人で締め切りました`
          : `当日チーム分けのエントリーは残り${left}人分です。${people.length}人ではエントリーできません`,
      extra: { full: left === 0, left },
    };
  }
  const dup = people.find((p) => names.has(p.name));
  if (dup) {
    return {
      ok: false,
      status: 409,
      code: "duplicate",
      message: `「${dup.name}」さんは既に登録されています。別の方の場合は、名前の後ろに学科などを付けてください（例: 田中太郎(電気)）`,
      extra: { duplicate: true },
    };
  }

  const groupId = randomUUID();
  const { error } = await sb.from("individuals").insert(people.map((p) => ({ ...p, group_id: groupId })));
  if (error) return { ok: false, status: 500, code: "error", message: "登録に失敗しました" };
  return { ok: true, kind: "individual", message: `${people.length}人分を登録しました` };
}
