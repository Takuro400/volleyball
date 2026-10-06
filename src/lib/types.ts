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
  created_at: string;
};

export type Round = "league" | "bracket";

export type Match = {
  id: string;
  round: Round;
  block: Block | null;
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
};

export const EVENT_DATE_ISO = "2026-11-27T11:00:00+09:00";
export const EVENT_LABEL = "2026年11月27日(金) 11:00〜16:00";
export const VENUE = "折尾スポーツセンター";

export function isBlock(v: unknown): v is Block {
  return typeof v === "string" && (BLOCKS as readonly string[]).includes(v);
}
