"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import {
  AdminBadge,
  Card,
  EmptyState,
  ErrorText,
  GhostButton,
  PrimaryButton,
  SectionTitle,
  SetupNotice,
  inputClass,
} from "@/components/ui";
import { ApiError, postJson, useTeams } from "@/lib/hooks";
import { BLOCKS, type Team } from "@/lib/types";

type MemberDraft = { name: string };

const emptyMember = (): MemberDraft => ({ name: "" });

function EntryForm({ onRegistered }: { onRegistered: () => void }) {
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([
    emptyMember(),
    emptyMember(),
  ]);
  const [leaderIndex, setLeaderIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const updateMember = (i: number, patch: Partial<MemberDraft>) => {
    setMembers((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  };

  const removeMember = (i: number) => {
    setMembers((prev) => prev.filter((_, j) => j !== i));
    setLeaderIndex((prev) => (i === prev ? 0 : i < prev ? prev - 1 : prev));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    setBusy(true);
    try {
      await postJson("/api/entry", "POST", {
        name: teamName,
        members: members.map((m, i) => ({
          name: m.name,
          isLeader: i === leaderIndex,
        })),
      });
      setTeamName("");
      setMembers([emptyMember(), emptyMember()]);
      setLeaderIndex(0);
      setDone(true);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">チーム名</label>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="例: 折尾アタッカーズ"
            className={inputClass}
            maxLength={30}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-sm font-medium">メンバー</label>
            <span className="text-xs text-muted">リーダーを1人選択</span>
          </div>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={m.name}
                  onChange={(e) => updateMember(i, { name: e.target.value })}
                  placeholder={`メンバー${i + 1} の名前`}
                  className={inputClass}
                  maxLength={30}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="leader"
                    checked={leaderIndex === i}
                    onChange={() => setLeaderIndex(i)}
                    className="accent-navy"
                  />
                  リーダー
                </label>
                {members.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    aria-label="このメンバーを削除"
                    className="shrink-0 rounded-md border border-line px-2.5 py-2 text-sm text-muted transition-colors hover:border-red-400 hover:text-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <GhostButton
            onClick={() => setMembers((prev) => [...prev, emptyMember()])}
            className="mt-2 w-full"
          >
            ＋ メンバーを追加
          </GhostButton>
        </div>

        <ErrorText>{error}</ErrorText>
        {done && (
          <p className="text-sm font-medium text-navy">
            エントリーを受け付けました！
          </p>
        )}
        <PrimaryButton type="submit" disabled={busy} className="w-full">
          {busy ? "送信中…" : "エントリーする"}
        </PrimaryButton>
        <p className="text-xs text-muted">
          出場ブロックは大会運営がランダムに割り当てます。
        </p>
      </form>
    </Card>
  );
}

function TeamList({ teams }: { teams: Team[] }) {
  const groups = useMemo(() => {
    const byBlock = new Map<string, Team[]>();
    for (const b of BLOCKS) byBlock.set(b, []);
    byBlock.set("未定", []);
    for (const t of teams) {
      byBlock.get(t.block ?? "未定")!.push(t);
    }
    return byBlock;
  }, [teams]);

  if (teams.length === 0) {
    return <EmptyState>まだエントリーがありません</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {[...groups.entries()]
        .filter(([, list]) => list.length > 0)
        .map(([block, list]) => (
          <Card key={block}>
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="font-mono text-xs font-medium text-amber-deep">
                {block === "未定" ? "ブロック未定" : `ブロック ${block}`}
              </span>
              <span className="font-mono text-xs text-muted">
                {list.length} teams
              </span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((t) => (
                <li key={t.id} className="px-4 py-2.5 text-sm font-medium">
                  {t.name}
                </li>
              ))}
            </ul>
          </Card>
        ))}
    </div>
  );
}

function AdminPanel({ onChanged }: { onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  const run = async (
    key: string,
    confirmText: string,
    fn: () => Promise<unknown>,
    doneText: string
  ) => {
    if (!window.confirm(confirmText)) return;
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage(doneText);
      onChanged();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-amber bg-amber/10 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AdminBadge /> 運営操作
      </p>
      <div className="space-y-2">
        <PrimaryButton
          className="w-full"
          disabled={busy !== null}
          onClick={() =>
            run(
              "assign",
              "全チームをシャッフルして A〜E ブロックへ割り当て直します。既存の割当は上書きされます。よろしいですか？",
              async () => {
                try {
                  await postJson("/api/admin/assign-blocks", "POST");
                } catch (e) {
                  // 試合が既にある場合は、消してよいか確認してからやり直す
                  if (e instanceof ApiError && e.status === 409) {
                    const ok = window.confirm(
                      `既に${Number(e.data.existing ?? 0)}試合が登録されています。ブロックを割り当て直すと、全ての試合と結果が削除されます。続けますか？`
                    );
                    if (!ok) throw new Error("ブロックの割当を取りやめました");
                    await postJson("/api/admin/assign-blocks", "POST", { force: true });
                    return;
                  }
                  throw e;
                }
              },
              "ブロックを割り当てました"
            )
          }
        >
          {busy === "assign" ? "割当中…" : "ブロックをランダム割当"}
        </PrimaryButton>
        {isDev && (
          <div className="flex gap-2">
            <GhostButton
              className="flex-1"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "seed",
                  "【開発用】ダミーチームを20件投入します。よろしいですか？",
                  () => postJson("/api/admin/seed", "POST"),
                  "ダミーデータを投入しました"
                )
              }
            >
              {busy === "seed" ? "投入中…" : "シミュレーション用データ投入"}
            </GhostButton>
            <GhostButton
              className="flex-1"
              disabled={busy !== null}
              onClick={() =>
                run(
                  "reset",
                  "【開発用】全チーム・全試合データを削除します。本当によろしいですか？",
                  () => postJson("/api/admin/seed", "DELETE"),
                  "全データを削除しました"
                )
              }
            >
              {busy === "reset" ? "削除中…" : "全データリセット"}
            </GhostButton>
          </div>
        )}
      </div>
      {message && <p className="mt-2 text-sm font-medium">{message}</p>}
      {isDev && (
        <p className="mt-2 text-xs text-muted">
          シミュレーション機能は開発環境でのみ表示されます。
        </p>
      )}
    </Card>
  );
}

export default function EntryPage() {
  const { admin } = useAdmin();
  const { data: teams, error, loading, refresh } = useTeams();

  if (error === "unconfigured") return <SetupNotice />;

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>チームエントリー</SectionTitle>
        <EntryForm onRegistered={refresh} />
      </section>

      {admin && <AdminPanel onChanged={refresh} />}

      <section>
        <SectionTitle>
          登録済みチーム
          {teams ? (
            <span className="font-mono text-sm text-muted">
              ({teams.length})
            </span>
          ) : null}
        </SectionTitle>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : error ? (
          <ErrorText>{error}</ErrorText>
        ) : (
          <TeamList teams={teams ?? []} />
        )}
      </section>
    </div>
  );
}
