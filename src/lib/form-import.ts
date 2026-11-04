import type { SupabaseClient } from "@supabase/supabase-js";
import { createIndividualEntry, createTeamEntry } from "./entry-core";
import { parseFormAnswers } from "./form-parse";

// Googleフォームの1件の回答を、アプリに登録する（サーバー専用）。
// 自動反映（Apps Script）と、運営の貼り付け取り込みの両方がこれを使う。

export type ImportStatus = "accepted" | "full" | "duplicate" | "invalid" | "error";

export type ImportResult = {
  status: ImportStatus;
  message: string;
  kind?: "team" | "individual";
  // 取り込んだ内容（画面の結果表示用）
  label?: string;
};

// 結果の表示用に、見た目を崩す特殊な結合文字を取り除く（登録の可否の判定には影響しない）
const safeLabel = (s: string) => s.replace(/\p{M}/gu, "").trim() || "（名前が正しくありません）";

export async function importFormAnswers(
  sb: SupabaseClient,
  answers: Record<string, string>
): Promise<ImportResult> {
  const parsed = parseFormAnswers(answers);
  if (parsed.type === "error") return { status: "invalid", message: parsed.message };

  if (parsed.type === "team") {
    const r = await createTeamEntry(sb, { name: parsed.name, members: parsed.members });
    const label = `${safeLabel(parsed.name)}（${parsed.members.length}人）`;
    return r.ok
      ? { status: "accepted", message: r.message, kind: "team", label }
      : { status: r.code, message: r.message, kind: "team", label };
  }

  const r = await createIndividualEntry(sb, { people: parsed.people });
  const label = parsed.people.map((p) => safeLabel(p.name)).join("・");
  return r.ok
    ? { status: "accepted", message: r.message, kind: "individual", label }
    : { status: r.code, message: r.message, kind: "individual", label };
}
