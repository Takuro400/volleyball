import type { Gender } from "./types";

// Googleフォーム（→スプレッドシート）の回答を、アプリのエントリーに変換する。
// 画面のインポート（貼り付け）と、Apps Script からの自動送信の両方で同じ読み取りを使う。
//
// 【チーム用フォーム】の質問
//   「チーム名」「メンバー全員の名前（リーダーを1人目に、1行に1人ずつ）」
// 【当日チーム分け用フォーム】の質問
//   「何人でエントリーしますか？」（任意）
//   「1人目の名前」「1人目の性別」「1人目は経験者ですか？」 …（2人目・3人目も同じ）

export type ParsedTeam = {
  type: "team";
  name: string;
  members: { name: string; isLeader: boolean }[];
};
export type ParsedIndividuals = {
  type: "individual";
  people: { name: string; gender: Gender; experienced: boolean }[];
};
export type ParsedEntry = ParsedTeam | ParsedIndividuals;
export type ParseResult = ParsedEntry | { type: "error"; message: string };

const clean = (s: string | undefined) => (s ?? "").replace(/\r/g, "").trim();

function findKey(answers: Record<string, string>, test: (k: string) => boolean): string | undefined {
  return Object.keys(answers).find(test);
}

export function parseGender(v: string): Gender {
  const s = v.normalize("NFKC").trim();
  if (/^(女|女性|female|f)$/i.test(s)) return "female";
  if (/^(男|男性|male|m)$/i.test(s)) return "male";
  return "none";
}

export function parseYes(v: string): boolean {
  const s = v.normalize("NFKC").trim();
  return /^(はい|yes|y|○|〇|経験者|有|あり|経験あり)/i.test(s);
}

// 「山田 太郎」「山田太郎、鈴木 花子」「1行に1人」などを人ごとに分ける
export function splitNames(v: string): string[] {
  return v
    .replace(/\r/g, "")
    .split(/\n+/)
    .flatMap((line) => (/[、,，]/.test(line) ? line.split(/[、,，]/) : [line]))
    .map((s) => s.replace(/^[\s・\-*\d.)）]+/, "").trim())
    .filter(Boolean);
}

export function parseFormAnswers(answersRaw: Record<string, string>): ParseResult {
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(answersRaw)) answers[k.normalize("NFKC").trim()] = clean(String(v ?? ""));

  // 当日チーム分け用: 「1人目の名前」がある
  const first = findKey(answers, (k) => /^1人目.*名前/.test(k));
  if (first) {
    const people: ParsedIndividuals["people"] = [];
    for (let n = 1; n <= 10; n++) {
      const nameKey = findKey(answers, (k) => new RegExp(`^${n}人目.*名前`).test(k));
      if (!nameKey) break;
      const name = answers[nameKey];
      if (!name) continue; // 2人目・3人目が空欄なら、その人はいない
      const genderKey = findKey(answers, (k) => new RegExp(`^${n}人目.*性別`).test(k));
      const expKey = findKey(answers, (k) => new RegExp(`^${n}人目.*経験`).test(k));
      people.push({
        name,
        gender: genderKey ? parseGender(answers[genderKey]) : "none",
        experienced: expKey ? parseYes(answers[expKey]) : false,
      });
    }
    if (people.length === 0) return { type: "error", message: "名前が入力されていません" };
    return { type: "individual", people };
  }

  // チーム用: 「チーム名」と「メンバー全員の名前」がある。
  // 電話番号・意気込みなどの質問が増えても取り違えないよう、タイトルの「先頭」で探し、
  // メンバーの質問が複数あるときは「名前」を含むものを選ぶ。
  const teamKey =
    findKey(answers, (k) => k.startsWith("チーム名")) ?? findKey(answers, (k) => k.includes("チーム名"));
  const memberCandidates = Object.keys(answers).filter((k) => k.startsWith("メンバー"));
  const memberKey =
    memberCandidates.find((k) => k.includes("名前")) ??
    memberCandidates[0] ??
    findKey(answers, (k) => k.includes("メンバー") && k.includes("名前"));
  if (teamKey && memberKey) {
    const names = splitNames(answers[memberKey]);
    if (names.length === 0) return { type: "error", message: "メンバーが入力されていません" };
    return {
      type: "team",
      name: answers[teamKey],
      members: names.map((name, i) => ({ name, isLeader: i === 0 })),
    };
  }

  return {
    type: "error",
    message: "フォームの質問が見つかりません（質問の名前を変えていないか確認してください）",
  };
}

// スプレッドシートからコピーした表（タブ区切り。セル内の改行は "..." で囲まれる）を行と列に分ける
export function parseTable(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"' && cell === "") {
      inQuotes = true;
    } else if (c === "\t") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

// 先頭行を質問名として、各行を「質問名 → 回答」の形にする
export function tableToAnswers(text: string): Record<string, string>[] {
  const table = parseTable(text);
  if (table.length < 2) return [];
  const header = table[0].map((h) => h.trim());
  return table.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h) o[h] = r[i] ?? "";
    });
    return o;
  });
}
