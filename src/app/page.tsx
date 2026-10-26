"use client";

import { useEffect, useState } from "react";
import { useMatches, useSettings, useTeams } from "@/lib/hooks";
import {
  DEFAULT_SCHEDULE,
  EVENT_DATE_ISO,
  EVENT_LABEL,
  PARTICIPANTS,
  VENUE,
} from "@/lib/types";
import LiveBoard from "@/components/LiveBoard";
import { TIMETABLE } from "@/lib/timetable";
import { Card, SectionTitle, SetupNotice } from "@/components/ui";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function remainingTo(target: Date): Remaining | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

function Countdown() {
  const [remaining, setRemaining] = useState<Remaining | null | "loading">(
    "loading"
  );

  useEffect(() => {
    const target = new Date(EVENT_DATE_ISO);
    const tick = () => setRemaining(remainingTo(target));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const units: { key: keyof Remaining; label: string }[] = [
    { key: "days", label: "DAYS" },
    { key: "hours", label: "HRS" },
    { key: "minutes", label: "MIN" },
    { key: "seconds", label: "SEC" },
  ];

  return (
    <Card className="bg-navy p-6 text-white">
      <p className="font-mono text-xs tracking-widest text-amber">
        COUNTDOWN — 2026.11.27
      </p>
      {remaining === null ? (
        <p className="mt-4 font-display text-3xl font-bold">
          大会当日です！🏐
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {units.map(({ key, label }) => (
            <div key={key} className="text-center">
              <div className="font-countdown text-4xl font-black tabular-nums tracking-wide text-amber sm:text-5xl">
                {remaining === "loading"
                  ? "--"
                  : String(remaining[key]).padStart(2, "0")}
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-widest text-white/60">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EntryCount() {
  const { data: teams, error, loading } = useTeams();

  if (error === "unconfigured") return <SetupNotice />;

  return (
    <Card className="flex items-center justify-between p-5">
      <div>
        <p className="text-sm text-muted">現在のエントリー</p>
        <p className="mt-1 text-lg font-semibold">
          <span className="font-display text-3xl font-bold text-navy">
            {loading ? "–" : (teams?.length ?? 0)}
          </span>{" "}
          チームがエントリー中
        </p>
      </div>
      <span className="inline-block h-10 w-1.5 bg-amber" aria-hidden />
    </Card>
  );
}

// 大会当日だけ、いま行われている試合を表示する
function HomeLive() {
  const teams = useTeams();
  const matches = useMatches();
  const settings = useSettings();
  return (
    <LiveBoard
      matches={matches.data ?? []}
      teams={teams.data ?? []}
      slotMinutes={settings.data?.slot_minutes ?? DEFAULT_SCHEDULE.slotMinutes}
    />
  );
}

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Countdown />
      <HomeLive />

      <section>
        <SectionTitle>開催概要</SectionTitle>
        <Card className="divide-y divide-line">
          <div className="flex items-baseline gap-4 p-4">
            <span className="w-14 shrink-0 font-mono text-xs text-muted">日時</span>
            <span className="text-sm font-medium">{EVENT_LABEL}</span>
          </div>
          <div className="flex items-baseline gap-4 p-4">
            <span className="w-14 shrink-0 font-mono text-xs text-muted">会場</span>
            <span className="text-sm font-medium">{VENUE}</span>
          </div>
          <div className="flex items-baseline gap-4 p-4">
            <span className="w-14 shrink-0 font-mono text-xs text-muted">対象</span>
            <span className="text-sm font-medium">{PARTICIPANTS}</span>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>タイムスケジュール</SectionTitle>
        <Card className="divide-y divide-line">
          {TIMETABLE.map((item) => (
            <div
              key={item.start}
              className={`flex gap-4 px-4 py-3 ${item.kind === "break" ? "bg-paper" : ""}`}
            >
              <span className="w-[5.75rem] shrink-0 pt-0.5 font-mono text-xs text-navy">
                {item.start}–{item.end}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm ${
                    item.kind === "match"
                      ? "font-semibold"
                      : item.kind === "break"
                        ? "text-muted"
                        : "font-medium"
                  }`}
                >
                  {item.title}
                </p>
                {item.note && <p className="mt-0.5 text-xs text-muted">{item.note}</p>}
              </div>
            </div>
          ))}
        </Card>
      </section>

      <EntryCount />
    </div>
  );
}
