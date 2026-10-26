"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase/client";
import { DEFAULT_SCHEDULE, type Match, type Settings, type Team } from "./types";

export type FetchState<T> = {
  data: T | null;
  // "unconfigured" は Supabase の環境変数が未設定の状態
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

// pollMs を指定すると、画面が表示されている間その間隔で自動的に最新データを取り直す。
function useTable<T>(fetcher: () => Promise<T>, pollMs?: number): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);

  const refresh = useCallback(async () => {
    if (!getSupabase()) {
      setError("unconfigured");
      setLoading(false);
      return;
    }
    try {
      setData(await fetcher());
      loaded.current = true;
      setError(null);
    } catch (e) {
      // 一度表示できていれば、通信が一瞬途切れても画面はそのまま(次の更新で直る)
      if (!loaded.current) {
        setError(e instanceof Error ? e.message : "データの取得に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refresh();
    // タブ切り替えやアプリから戻ってきたときに最新化する
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh]);

  return { data, error, loading, refresh };
}

// 現在時刻(ミリ秒)。最初の描画では null（サーバーとの表示のずれを防ぐため）。
// 確認用に、URL に ?now=2026-11-27T11:15:00%2B09:00 を付けると、その時刻から進む。
export function useNow(intervalMs = 15000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const override = Date.parse(
      new URLSearchParams(window.location.search).get("now") ?? ""
    );
    const offset = Number.isNaN(override) ? 0 : override - Date.now();
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

async function fetchTeams(): Promise<Team[]> {
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("teams")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  // 追加した列がまだ無いデータベースでも動くよう、欠けている値は null にそろえる
  return ((data ?? []) as Team[]).map((t) => ({
    ...t,
    manual_rank: t.manual_rank ?? null,
    kind: t.kind ?? "entry",
  }));
}

async function fetchMatches(): Promise<Match[]> {
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("matches")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Match[]).map((m) => ({ ...m, slot: m.slot ?? null }));
}

async function fetchSettings(): Promise<Settings> {
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const s = (data ?? { id: 1, rules: "", photo_link: "" }) as Partial<Settings>;
  return {
    id: 1,
    rules: s.rules ?? "",
    photo_link: s.photo_link ?? "",
    schedule_start: s.schedule_start ?? DEFAULT_SCHEDULE.startTime,
    slot_minutes: s.slot_minutes ?? DEFAULT_SCHEDULE.slotMinutes,
    courts: s.courts ?? DEFAULT_SCHEDULE.courts,
  };
}

// 試合の結果はリアルタイムに近い間隔(20秒)で、チームの変更はゆっくり(60秒)取り直す
export function useTeams() {
  return useTable(fetchTeams, 60_000);
}

export function useMatches() {
  return useTable(fetchMatches, 20_000);
}

export function useSettings() {
  return useTable(fetchSettings);
}

// 個人エントリーの人数（名前などは公開しないので、専用のAPIから人数だけ取る）
export function useIndividualCount() {
  const [count, setCount] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/individual/count", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { count?: number };
      if (typeof json.count === "number") setCount(json.count);
    } catch {
      /* 通信エラーのときは前回の表示のまま */
    }
  }, []);

  useEffect(() => {
    // 初回の取得は非同期コールバックの中で setState される
    const first = setTimeout(refresh, 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  return { count, refresh };
}

// 運営APIの共通呼び出し。エラー時は日本語メッセージの ApiError を throw する。
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function postJson<T = unknown>(
  url: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof json.error === "string" ? json.error : "エラーが発生しました",
      res.status,
      json
    );
  }
  return json as T;
}
