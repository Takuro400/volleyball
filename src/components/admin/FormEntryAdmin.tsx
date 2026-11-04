"use client";

import { useMemo, useState } from "react";
import { parseFormAnswers, tableToAnswers } from "@/lib/form-parse";
import { postJson } from "@/lib/hooks";
import type { EntryMode, Settings } from "@/lib/types";
import { AdminBadge, Card, ErrorText, GhostButton, PrimaryButton, inputClass } from "../ui";

type ImportResultRow = { status: string; message: string; label?: string; kind?: string };
type ImportResponse = {
  results: ImportResultRow[];
  summary: { accepted: number; full: number; duplicate: number; invalid: number; error: number };
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  accepted: { text: "登録", cls: "text-navy" },
  full: { text: "満員", cls: "text-red-700" },
  duplicate: { text: "重複", cls: "text-muted" },
  invalid: { text: "不正", cls: "text-red-700" },
  error: { text: "エラー", cls: "text-red-700" },
};

// 運営用: Googleフォームでのエントリー受付の設定と、スプレッドシートからの取り込み
export default function FormEntryAdmin({
  settings,
  onChanged,
}: {
  settings: Settings;
  onChanged: () => void;
}) {
  const [teamUrl, setTeamUrl] = useState(settings.form_team_url);
  const [indUrl, setIndUrl] = useState(settings.form_individual_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const save = async (patch: Record<string, string>, doneText: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await postJson("/api/admin/settings", "PATCH", patch);
      setMessage(doneText);
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "保存に失敗しました。Supabase で最新の追加SQLを実行してください"
      );
    } finally {
      setBusy(false);
    }
  };

  const setMode = (mode: EntryMode) =>
    save(
      { entry_mode: mode },
      mode === "form"
        ? "受付方法を「Googleフォーム」にしました。アプリ内のエントリーフォームは閉じています"
        : "受付方法を「アプリ内フォーム」にしました。誰でもアプリから登録できます"
    );

  // 貼り付けた表を、取り込む前に読み取って確認する
  const preview = useMemo(() => {
    const rows = tableToAnswers(text);
    const parsed = rows.map((r) => parseFormAnswers(r));
    return {
      rows,
      teams: parsed.filter((p) => p.type === "team").length,
      individuals: parsed.filter((p) => p.type === "individual").length,
      errors: parsed.flatMap((p, i) => (p.type === "error" ? [`${i + 1}行目: ${p.message}`] : [])),
    };
  }, [text]);

  const runImport = async () => {
    if (preview.rows.length === 0) return;
    if (!window.confirm(`${preview.rows.length}件を取り込みます。既に登録済みの名前は自動で飛ばします。よろしいですか？`)) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await postJson<ImportResponse>("/api/admin/import", "POST", { rows: preview.rows });
      setResult(res);
      setText("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "取り込みに失敗しました");
    } finally {
      setImporting(false);
    }
  };

  const modeBtn = (mode: EntryMode, label: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => setMode(mode)}
      className={`flex-1 rounded-md border px-2 py-2 text-sm font-medium transition-colors ${
        settings.entry_mode === mode
          ? "border-navy bg-navy text-white"
          : "border-line bg-white text-muted hover:border-navy hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card className="border-amber bg-amber/10 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AdminBadge /> Googleフォーム連携
      </p>

      <p className="mb-1.5 text-xs text-muted">エントリーの受付方法</p>
      <div className="flex gap-2">
        {modeBtn("form", "Googleフォームで受付")}
        {modeBtn("app", "アプリ内フォームで受付")}
      </div>
      <p className="mt-1 text-xs text-muted">
        「Googleフォーム」の間は、アプリ内のフォームは閉じます（運営の手入力だけ可）。
      </p>

      <div className="mt-4 space-y-2">
        <p className="text-xs text-muted">フォームのリンク（参加者に表示されます）</p>
        <input
          value={teamUrl}
          onChange={(e) => setTeamUrl(e.target.value)}
          placeholder="チームで参加するフォーム  https://forms.gle/…"
          className={inputClass}
          type="url"
          aria-label="チーム用フォームのリンク"
        />
        <input
          value={indUrl}
          onChange={(e) => setIndUrl(e.target.value)}
          placeholder="当日チーム分けで参加するフォーム  https://forms.gle/…"
          className={inputClass}
          type="url"
          aria-label="当日チーム分け用フォームのリンク"
        />
        <PrimaryButton
          disabled={busy}
          className="w-full"
          onClick={() =>
            save({ form_team_url: teamUrl, form_individual_url: indUrl }, "フォームのリンクを保存しました")
          }
        >
          {busy ? "保存中…" : "リンクを保存"}
        </PrimaryButton>
      </div>
      <ErrorText>{error}</ErrorText>
      {message && <p className="mt-2 text-sm font-medium text-navy">{message}</p>}

      <details className="mt-4 rounded-md border border-line bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium">
          スプレッドシートから取り込む（手動）
        </summary>
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">
            フォームの回答スプレッドシートを、1行目（質問名）から全部選んでコピーし、ここに貼り付けてください。チーム用と当日チーム分け用は、別々に貼り付けます。自動反映が止まったときの予備です。
          </p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            rows={6}
            placeholder="ここに貼り付け"
            className="w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-navy"
          />
          {preview.rows.length > 0 && (
            <div className="rounded-md bg-paper px-3 py-2 text-xs">
              <p className="font-medium">
                {preview.rows.length}件を読み取りました（チーム {preview.teams} / 当日チーム分け{" "}
                {preview.individuals}）
              </p>
              {preview.errors.slice(0, 5).map((m) => (
                <p key={m} className="mt-0.5 text-red-700">
                  ⚠ {m}
                </p>
              ))}
            </div>
          )}
          <PrimaryButton
            onClick={runImport}
            disabled={importing || preview.rows.length === 0}
            className="w-full"
          >
            {importing ? "取り込み中…" : "取り込む"}
          </PrimaryButton>
          {result && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                登録 {result.summary.accepted}件
                {result.summary.duplicate > 0 && ` / 重複 ${result.summary.duplicate}`}
                {result.summary.full > 0 && ` / 満員 ${result.summary.full}`}
                {result.summary.invalid + result.summary.error > 0 &&
                  ` / 不正・エラー ${result.summary.invalid + result.summary.error}`}
              </p>
              <ul className="space-y-1 text-xs">
                {result.results.map((r, i) => {
                  const s = STATUS_LABEL[r.status] ?? STATUS_LABEL.error;
                  return (
                    <li key={i} className="flex gap-2">
                      <span className={`w-10 shrink-0 font-mono font-medium ${s.cls}`}>{s.text}</span>
                      <span className="min-w-0 flex-1">
                        {r.label && <span className="font-medium">{r.label} </span>}
                        {r.status !== "accepted" && <span className="text-muted">— {r.message}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <GhostButton onClick={() => setResult(null)} className="w-full">
                閉じる
              </GhostButton>
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
