"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";
import type { Match, Settings, Team } from "./types";

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
  return (data ?? []) as Team[];
}

async function fetchMatches(): Promise<Match[]> {
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("matches")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Match[];
}

async function fetchSettings(): Promise<Settings> {
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? { id: 1, rules: "", photo_link: "" }) as Settings;
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

// 運営APIの共通呼び出し。エラー時は日本語メッセージを throw する。
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
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (json as { error?: string }).error ?? "エラーが発生しました"
    );
  }
  return json as T;
}
