export const BLOCKS = ["A", "B", "C", "D", "E"] as const;
export type Block = (typeof BLOCKS)[number];

export const DEPTS = [
  "建設社会類",
  "機械類",
  "電気類",
  "物質理工学類",
  "総合類",
] as const;
export type Dept = (typeof DEPTS)[number];

export type Member = {
  name: string;
  dept: Dept;
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

export function isDept(v: unknown): v is Dept {
  return typeof v === "string" && (DEPTS as readonly string[]).includes(v);
}
