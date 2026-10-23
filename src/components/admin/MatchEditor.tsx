"use client";

import { useState } from "react";
import { postJson } from "@/lib/hooks";
import type { Match, Team } from "@/lib/types";
import { GhostButton, inputClass, selectClass } from "../ui";

// 運営用: 1試合の時間・コート・対戦チームを手で直す。
// トーナメントの試合は参加チームが順位と結果から自動で決まるので、時間とコートだけ直せる。
export default function MatchEditor({
  match,
  allMatches,
  teams,
  courts,
  editableTeams,
  onChanged,
}: {
  match: Match;
  // 重なりの警告に使う、全試合の一覧
  allMatches: Match[];
  teams: Team[];
  courts: number;
  editableTeams: boolean;
  onChanged: () => void;
}) {
  const [time, setTime] = useState(match.time ?? "");
  const [court, setCourt] = useState(match.court ?? "");
  const [teamA, setTeamA] = useState(match.team_a ?? "");
  const [teamB, setTeamB] = useState(match.team_b ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const nameOf = (id: string | null) =>
    teams.find((t) => t.id === id)?.name ?? "未定";

  // 入力中の内容が他の試合と重なっていないか（保存は止めず、注意だけ出す）
  const warnings: string[] = [];
  if (time) {
    const sameTime = allMatches.filter((m) => m.id !== match.id && m.time === time);
    if (court && sameTime.some((m) => m.court === court)) {
      warnings.push(`${time}のコート${court}に、別の試合が入っています`);
    }
    const a = editableTeams ? teamA : match.team_a;
    const b = editableTeams ? teamB : match.team_b;
    const clash = sameTime.find(
      (m) =>
        [m.team_a, m.team_b].some((id) => id !== null && (id === a || id === b))
    );
    if (clash) {
      const names = [a, b]
        .filter((id): id is string => !!id && (id === clash.team_a || id === clash.team_b))
        .map(nameOf)
        .join("・");
      warnings.push(`${names} が同じ時間(${time})に別の試合にも出ることになります`);
    }
  }

  const maxCourt = Math.max(courts, Number(match.court) || 0);
  const dirty =
    time !== (match.time ?? "") ||
    court !== (match.court ?? "") ||
    (editableTeams &&
      (teamA !== (match.team_a ?? "") || teamB !== (match.team_b ?? "")));

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await postJson("/api/admin/matches", "PATCH", {
        id: match.id,
        time,
        court,
        ...(editableTeams ? { teamA, teamB } : {}),
      });
      setSaved(true);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("この試合を削除しますか？")) return;
    try {
      await postJson("/api/admin/matches", "DELETE", { id: match.id });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const teamSelect = (value: string, set: (v: string) => void, label: string) => (
    <select
      value={value}
      onChange={(e) => set(e.target.value)}
      className={selectClass}
      aria-label={label}
    >
      <option value="">{label}</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
          {t.block ? `（${t.block}）` : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="mb-2 flex items-center gap-2 text-xs text-muted">
        {match.block && (
          <span className="font-mono text-amber-deep">ブロック{match.block}</span>
        )}
        {!editableTeams && (
          <span className="truncate">
            {nameOf(match.team_a)} vs {nameOf(match.team_b)}
          </span>
        )}
      </p>
      {editableTeams && (
        <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {teamSelect(teamA, setTeamA, "チームA")}
          <span className="font-mono text-xs text-muted">vs</span>
          {teamSelect(teamB, setTeamB, "チームB")}
        </div>
      )}
      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={inputClass}
          aria-label="開始時間"
        />
        <select
          value={court}
          onChange={(e) => setCourt(e.target.value)}
          className={selectClass}
          aria-label="コート"
        >
          <option value="">コート未定</option>
          {Array.from({ length: maxCourt }, (_, i) => String(i + 1)).map((c) => (
            <option key={c} value={c}>
              コート{c}
            </option>
          ))}
        </select>
        <GhostButton
          onClick={save}
          disabled={busy || !dirty || (editableTeams && (!teamA || !teamB || teamA === teamB))}
          className="px-3 py-2 text-xs"
        >
          {busy ? "…" : "保存"}
        </GhostButton>
      </div>
      {warnings.map((w) => (
        <p key={w} className="mt-1 text-xs font-medium text-amber-deep">
          ⚠ {w}
        </p>
      ))}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      {saved && !dirty && <p className="mt-1 text-xs text-navy">保存しました</p>}
      {editableTeams && (
        <div className="mt-1 text-right">
          <button
            onClick={remove}
            className="text-xs text-muted underline-offset-2 hover:text-red-600 hover:underline"
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}
