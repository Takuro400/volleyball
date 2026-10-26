export const BLOCKS = ["A", "B", "C", "D", "E"] as const;
export type Block = (typeof BLOCKS)[number];

// 所属学科は他大学（西南女学院大学など）の参加を考慮して収集しない。
// 大会後のアンケートで回答してもらう。
export type Member = {
  name: string;
  isLeader: boolean;
};

export type Team = {
  id: string;
  name: string;
  block: Block | null;
  members: Member[];
  // 勝ち数・得失点差・総得点まで完全に同率のとき、運営が手動で決めた順位（小さいほど上位）
  manual_rank: number | null;
  created_at: string;
};

export type Round = "league" | "bracket";

// 決勝トーナメントの試合の位置（1回戦=R1、準々決勝=QF、準決勝=SF、決勝=F）
export type SlotId =
  | "R1-1"
  | "R1-2"
  | "QF1"
  | "QF2"
  | "QF3"
  | "QF4"
  | "SF1"
  | "SF2"
  | "F";

export type Match = {
  id: string;
  round: Round;
  block: Block | null;
  // トーナメントの試合のみ。リーグ戦は null
  slot: SlotId | null;
  team_a: string | null;
  team_b: string | null;
  score_a: number | null;
  score_b: number | null;
  time: string | null;
  court: string | null;
  created_at: string;
};

export type Settings = {
  id: number;
  rules: string;
  photo_link: string;
  schedule_start: string;
  slot_minutes: number;
  courts: number;
};

// リーグ戦スケジュール自動生成の初期値
export const DEFAULT_SCHEDULE = {
  startTime: "10:45",
  slotMinutes: 15,
  courts: 3,
} as const;

export const EVENT_DATE_ISO = "2026-11-27T10:00:00+09:00";
export const EVENT_LABEL = "2026年11月27日(金) 10:00〜16:00";
export const PARTICIPANTS = "九州工業大学・西南女学院大学の1年生";
export const VENUE = "折尾スポーツセンター";

export function isBlock(v: unknown): v is Block {
  return typeof v === "string" && (BLOCKS as readonly string[]).includes(v);
}
