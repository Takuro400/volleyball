// 当日のタイムスケジュール（受付〜閉会式）。ホーム画面に表示する。
// 準備・撤収など運営だけのスケジュールは含めない。

export type TimetableItem = {
  start: string;
  end: string;
  title: string;
  note?: string;
  // break=休憩など / ceremony=式典 / match=試合
  kind: "match" | "break" | "ceremony";
};

export const TIMETABLE: TimetableItem[] = [
  { start: "10:00", end: "10:30", title: "受付", kind: "ceremony" },
  { start: "10:30", end: "10:40", title: "開会式", kind: "ceremony" },
  {
    start: "10:45",
    end: "13:15",
    title: "リーグ戦",
    note: "15点マッチ・1試合15分枠×10ラウンド",
    kind: "match",
  },
  {
    start: "13:15",
    end: "13:45",
    title: "昼休憩・順位集計・決勝トーナメント組み合わせ発表",
    kind: "break",
  },
  {
    start: "13:45",
    end: "14:00",
    title: "決勝トーナメント 1回戦2試合 + 準々決勝1試合",
    note: "15点マッチ",
    kind: "match",
  },
  {
    start: "14:00",
    end: "14:15",
    title: "準々決勝3試合",
    note: "15点マッチ",
    kind: "match",
  },
  { start: "14:15", end: "14:25", title: "休憩・コート整備", kind: "break" },
  {
    start: "14:25",
    end: "14:55",
    title: "準決勝2試合",
    note: "25点マッチ・30分枠",
    kind: "match",
  },
  {
    start: "15:00",
    end: "15:30",
    title: "決勝",
    note: "25点マッチ・空きコートで3位決定戦も可",
    kind: "match",
  },
  {
    start: "15:30",
    end: "15:50",
    title: "エキシビションマッチ",
    note: "15点マッチ",
    kind: "match",
  },
  { start: "15:50", end: "16:00", title: "閉会式・表彰・集合写真", kind: "ceremony" },
];
