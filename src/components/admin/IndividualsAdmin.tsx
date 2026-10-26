"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { postJson } from "@/lib/hooks";
import { splitIntoTeams, type SplitResult } from "@/lib/team-split";
import {
  GENDER_LABEL,
  GUERRILLA_TEAM_SIZE,
  INDIVIDUAL_LIMIT,
  type Individual,
  type Team,
} from "@/lib/types";
import { AdminBadge, Card, ErrorText, GhostButton, PrimaryButton, inputClass } from "../ui";

type Group = { id: string; members: Individual[] };

function PersonTag({ p }: { p: Individual }) {
  return (
    <span className="flex shrink-0 gap-1 font-mono text-[10px]">
      <span className="rounded bg-paper px-1 text-muted">{GENDER_LABEL[p.gender]}</span>
      {p.experienced && <span className="rounded bg-amber/30 px-1 text-amber-deep">経験者</span>}
    </span>
  );
}

// 運営用: 個人・少人数エントリーの一覧と、当日のランダムチーム分け
export default function IndividualsAdmin({
  teams,
  onChanged,
}: {
  teams: Team[];
  onChanged: () => void;
}) {
  const [people, setPeople] = useState<Individual[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [teamCount, setTeamCount] = useState("");
  const [preview, setPreview] = useState<SplitResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await postJson<{ individuals: Individual[] }>("/api/admin/individuals", "GET");
      setPeople(res.individuals);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "編成済み";
  const existingGuerrilla = teams.filter((t) => t.kind === "guerrilla").length;

  const { groups, unassigned } = useMemo(() => {
    const byGroup = new Map<string, Individual[]>();
    for (const p of people ?? []) {
      byGroup.set(p.group_id, [...(byGroup.get(p.group_id) ?? []), p]);
    }
    const all: Group[] = [...byGroup.entries()].map(([id, members]) => ({ id, members }));
    // 未編成のメンバーだけを集めたグループ（チーム分けの対象）
    const open: Group[] = all
      .map((g) => ({ id: g.id, members: g.members.filter((m) => !m.team_id) }))
      .filter((g) => g.members.length > 0);
    return { groups: all, unassigned: open };
  }, [people]);

  const unassignedCount = unassigned.reduce((s, g) => s + g.members.length, 0);
  const defaultTeams = Math.max(1, Math.floor(unassignedCount / GUERRILLA_TEAM_SIZE));
  const effectiveTeamCount = Number(teamCount) >= 1 ? Math.floor(Number(teamCount)) : defaultTeams;

  const roll = () => {
    setMessage(null);
    setPreview(
      splitIntoTeams(
        unassigned.map((g) => ({ key: g.id, size: g.members.length })),
        effectiveTeamCount
      )
    );
  };

  const removePerson = async (p: Individual) => {
    if (!window.confirm(`「${p.name}」さんのエントリーを取り消しますか？`)) return;
    setError(null);
    setPreview(null);
    try {
      await postJson("/api/admin/individuals", "DELETE", { id: p.id });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const confirmSplit = async () => {
    if (!preview) return;
    if (
      !window.confirm(
        `この分け方で${preview.teams.length}チームを作ります。作成後に分け直すには、そのチームを削除してやり直します。よろしいですか？`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const byId = new Map(unassigned.map((g) => [g.id, g]));
      await postJson("/api/admin/individuals/split", "POST", {
        teams: preview.teams.map((keys, i) => ({
          name: `ゲリラチーム${existingGuerrilla + i + 1}`,
          ids: keys.flatMap((k) => (byId.get(k)?.members ?? []).map((m) => m.id)),
        })),
      });
      setMessage(
        `${preview.teams.length}チームを作りました。続けて「ブロックをランダム割当」を実行してください。`
      );
      setPreview(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "チームの作成に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const byKey = new Map(unassigned.map((g) => [g.id, g]));

  return (
    <Card className="border-amber bg-amber/10 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <AdminBadge /> 当日チーム分けエントリー（個人・少人数）
      </p>
      <p className="text-xs text-muted">
        登録 {people?.length ?? "–"}人 / 上限{INDIVIDUAL_LIMIT}人
        {people && `（${groups.length}組・チーム未編成 ${unassignedCount}人）`}
      </p>
      <ErrorText>{error}</ErrorText>
      {message && <p className="mt-2 text-sm font-medium text-navy">{message}</p>}

      {people && people.length === 0 && (
        <p className="mt-3 rounded-md bg-white px-3 py-3 text-sm text-muted">
          まだ当日チーム分けのエントリーはありません
        </p>
      )}

      {people && people.length > 0 && (
        <details className="mt-3 rounded-md border border-line bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium">エントリー一覧を見る</summary>
          <div className="mt-2 space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="rounded-md border border-line p-2">
                {g.members.length > 1 && (
                  <p className="mb-1 font-mono text-[10px] text-amber-deep">
                    {g.members.length}人組（同じチームになります）
                  </p>
                )}
                <ul className="space-y-1">
                  {g.members.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <PersonTag p={p} />
                      {p.team_id ? (
                        <span className="shrink-0 font-mono text-[10px] text-navy">
                          → {teamName(p.team_id)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removePerson(p)}
                          aria-label={`${p.name}のエントリーを取り消す`}
                          className="shrink-0 rounded-md border border-line px-2 py-0.5 text-xs text-muted hover:border-red-400 hover:text-red-600"
                        >
                          取消
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}

      {unassignedCount > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-end gap-2">
            <div className="w-28">
              <label className="mb-1 block text-xs text-muted">チーム数</label>
              <input
                type="number"
                min={1}
                max={10}
                value={teamCount}
                placeholder={String(defaultTeams)}
                onChange={(e) => {
                  setTeamCount(e.target.value);
                  setPreview(null);
                }}
                className={inputClass}
              />
            </div>
            <PrimaryButton onClick={roll} disabled={busy} className="flex-1">
              {preview ? "やり直す（もう一度ランダムに）" : "ランダムにチーム分け"}
            </PrimaryButton>
          </div>
          <p className="text-xs text-muted">
            未編成{unassignedCount}人を{effectiveTeamCount}チームに分けます（1チーム{GUERRILLA_TEAM_SIZE}人が目安）。
            一緒にエントリーした人は必ず同じチームになります。確定する前に、何度でもやり直せます。
          </p>

          {preview && (
            <div className="space-y-2">
              {preview.teams.map((keys, i) => (
                <div key={i} className="rounded-md border border-line bg-white p-3">
                  <p className="mb-1.5 flex items-center justify-between text-sm font-semibold">
                    <span>ゲリラチーム{existingGuerrilla + i + 1}</span>
                    <span className="font-mono text-xs text-muted">{preview.sizes[i]}人</span>
                  </p>
                  <div className="space-y-1">
                    {keys.map((k) => {
                      const g = byKey.get(k);
                      if (!g) return null;
                      return (
                        <div
                          key={k}
                          className={
                            g.members.length > 1
                              ? "rounded border border-dashed border-amber px-2 py-1"
                              : "px-2 py-0.5"
                          }
                        >
                          {g.members.map((m) => (
                            <p key={m.id} className="flex items-center gap-2 text-sm">
                              <span className="min-w-0 flex-1 truncate">{m.name}</span>
                              <PersonTag p={m} />
                            </p>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {preview.warnings.map((w) => (
                <p key={w} className="text-xs font-medium text-red-700">
                  ⚠ {w}
                </p>
              ))}
              <PrimaryButton onClick={confirmSplit} disabled={busy} className="w-full">
                {busy ? "作成中…" : "この分け方で確定してチームを作る"}
              </PrimaryButton>
              <GhostButton onClick={() => setPreview(null)} className="w-full">
                プレビューを閉じる
              </GhostButton>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
