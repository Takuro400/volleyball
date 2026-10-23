"use client";

import { useState } from "react";
import { ApiError, postJson } from "@/lib/hooks";
import { DEFAULT_SCHEDULE, type Settings } from "@/lib/types";
import { AdminBadge, Card, PrimaryButton, inputClass } from "../ui";

type GenerateResult = {
  count: number;
  slots: number;
  endTime: string;
  backToBack: number;
};

// 運営用: 各ブロックの総当たり戦を自動生成し、時間とコートを割り当てる
export default function LeagueGenerator({
  settings,
  existingCount,
  onDone,
}: {
  settings: Settings | null;
  existingCount: number;
  onDone: () => void;
}) {
  const [startTime, setStartTime] = useState(
    settings?.schedule_start ?? DEFAULT_SCHEDULE.startTime
  );
  const [slotMinutes, setSlotMinutes] = useState(
    String(settings?.slot_minutes ?? DEFAULT_SCHEDULE.slotMinutes)
  );
  const [courts, setCourts] = useState(
    String(settings?.courts ?? DEFAULT_SCHEDULE.courts)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const run = async (replace: boolean) => {
    const body = {
      startTime,
      slotMinutes: Number(slotMinutes),
      courts: Number(courts),
      replace,
    };
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<GenerateResult>(
        "/api/admin/league/generate",
        "POST",
        body
      );
      setResult(res);
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const total = Number(e.data.existing ?? 0);
        const scored = Number(e.data.scored ?? 0);
        const ok = window.confirm(
          `既に${total}試合が登録されています（うち${scored}試合は結果入力済み）。\n` +
            "すべて削除して作り直しますか？ 結果とトーナメントの試合も消えます。"
        );
        if (ok) {
          setBusy(false);
          await run(true);
          return;
        }
      } else {
        setError(e instanceof Error ? e.message : "生成に失敗しました");
      }
    } finally {
      setBusy(false);
    }
  };

  const labelClass = "mb-1 block text-xs text-muted";
  return (
    <Card className="border-amber bg-amber/10 p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <AdminBadge /> リーグ戦の自動生成
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={labelClass}>開始時刻</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>1試合の枠(分)</label>
          <input
            type="number"
            min={1}
            max={180}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>コート数</label>
          <input
            type="number"
            min={1}
            max={20}
            value={courts}
            onChange={(e) => setCourts(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {result && (
        <p className="mt-2 text-sm font-medium">
          {result.count}試合を生成しました（{result.slots}枠・{result.endTime}終了予定
          {result.backToBack === 0
            ? "・連続出場なし"
            : `・連続出場${result.backToBack}回`}
          ）
        </p>
      )}
      <PrimaryButton
        onClick={() => run(false)}
        disabled={busy || !startTime}
        className="mt-3 w-full"
      >
        {busy
          ? "生成中…"
          : existingCount > 0
            ? "作り直す（既存の試合を削除）"
            : "各ブロックの総当たりを自動生成"}
      </PrimaryButton>
      <p className="mt-2 text-xs text-muted">
        各ブロックの全チームが総当たり（4チームなら6試合・計30試合）。同じ枠に同じチームは出ず、できるだけ連続して試合しない並びにします。生成後も下の「試合の編集」で時間・コート・対戦を直せます。
      </p>
    </Card>
  );
}
