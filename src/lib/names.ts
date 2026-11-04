// 名前・チーム名の正規化と、いたずら入力（意味のない記号だけ、結合文字の連打など）の除外。
// 画面・サーバー・フォームの取り込みのすべてで同じルールを使う。

export type NameResult = { ok: true; value: string } | { ok: false; reason: string };

export function normalizeName(raw: unknown, max = 30): NameResult {
  if (typeof raw !== "string") return { ok: false, reason: "入力されていません" };
  // 全角/半角のゆれをそろえ、見えない文字や制御文字を取り除き、空白を1つにまとめる
  const value = raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return { ok: false, reason: "入力されていません" };
  if ([...value].length > max) return { ok: false, reason: `${max}文字以内にしてください` };
  // 文字や数字が1つも無い（記号だけ）ものは無効
  if (!/[\p{L}\p{N}]/u.test(value)) return { ok: false, reason: "文字を入力してください" };
  // 結合文字（上に積み重なって表示される特殊な文字）は、日本語・英数字の名前では使わないので無効
  // （濁点などは NFKC で文字に統合されるため、ここに残るのは特殊な結合文字だけ）
  if (/\p{M}/u.test(value)) return { ok: false, reason: "使えない文字が含まれています" };
  return { ok: true, value };
}
