"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";
import { DEFAULT_SCHEDULE, type Match, type Settings, type Team } from "./types";

export type FetchState<T> = {
  data: T | null;
  // "unconfigured" は Supabase の環境変数が未設定の状態
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

function useTable<T>(fetcher: () => Promise<T>): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getSupabase()) {
      setError("unconfigured");
      setLoading(false);
      return;
    }
    try {
      setData(await fetcher());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refresh();
    // 大会当日はタブ切り替えで戻ってきたときに最新化する
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { data, error, loading, refresh };
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

export function useTeams() {
  return useTable(fetchTeams);
}

export function useMatches() {
  return useTable(fetchMatches);
}

export function useSettings() {
  return useTable(fetchSettings);
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
