"use client";

import { useState } from "react";
import { postJson } from "@/lib/hooks";
import {
  GENDER_LABEL,
  INDIVIDUAL_LIMIT,
  MAX_GROUP_SIZE,
  type Gender,
} from "@/lib/types";
import { Card, ErrorText, PrimaryButton, inputClass } from "./ui";

type PersonDraft = { name: string; gender: Gender | ""; experienced: boolean };
const emptyPerson = (): PersonDraft => ({ name: "", gender: "", experienced: false });

// 当日チーム分け（1〜3人）でのエントリー。当日、運営がランダムにチームを編成する。
// 一緒にエントリーした人は、必ず同じチームになる。
export default function IndividualEntryForm({
  count,
  onRegistered,
}: {
  count: number | null;
  onRegistered: () => void;
}) {
  const [size, setSize] = useState(1);
  const [people, setPeople] = useState<PersonDraft[]>([emptyPerson()]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const left = count === null ? null : Math.max(0, INDIVIDUAL_LIMIT - count);
  const full = left === 0;

  const changeSize = (n: number) => {
    setSize(n);
    setPeople((prev) =>
      n <= prev.length ? prev.slice(0, n) : [...prev, ...Array.from({ length: n - prev.length }, emptyPerson)]
    );
  };

  const update = (i: number, patch: Partial<PersonDraft>) =>
    setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (people.some((p) => !p.name.trim())) {
      setError("全員の名前を入力してください");
      return;
    }
    if (people.some((p) => p.gender === "")) {
      setError("全員の性別を選択してください");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/individual", "POST", { people });
      setDone(people.length);
      setSize(1);
      setPeople([emptyPerson()]);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <p className="text-sm text-muted">
        チームを作っていない人も参加できます。当日、運営がランダムにチームを編成します。
        <span className="font-medium text-ink">
          {" "}
          一緒にエントリーした人は、必ず同じチームになります。
        </span>
      </p>
      <p className="mt-2 font-mono text-xs text-muted">
        当日チーム分けエントリー {count ?? "–"} / {INDIVIDUAL_LIMIT}人
        {left !== null && left > 0 && `（あと${left}人）`}
      </p>

      {full ? (
        <p className="mt-4 rounded-md bg-paper px-3 py-3 text-sm text-muted">
          当日チーム分けでのエントリーは{INDIVIDUAL_LIMIT}人で締め切りました。
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">何人でエントリーしますか？</p>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: MAX_GROUP_SIZE }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => changeSize(n)}
                  disabled={left !== null && n > left}
                  className={`rounded-md border py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    size === n
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-white text-muted hover:border-navy hover:text-ink"
                  }`}
                >
                  {n}人
                </button>
              ))}
            </div>
            {size > 1 && (
              <p className="mt-1.5 text-xs text-muted">
                この{size}人は、同じチームになります。
              </p>
            )}
          </div>

          {people.map((p, i) => (
            <div key={i} className="space-y-2 rounded-md border border-line p-3">
              {size > 1 && (
                <p className="font-mono text-xs text-amber-deep">{i + 1}人目</p>
              )}
              <input
                value={p.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="名前（フルネーム）"
                className={inputClass}
                maxLength={30}
                aria-label={`${i + 1}人目の名前`}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <span className="text-xs text-muted">性別</span>
                {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                  <label key={g} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name={`gender-${i}`}
                      checked={p.gender === g}
                      onChange={() => update(i, { gender: g })}
                      className="accent-navy"
                    />
                    {GENDER_LABEL[g]}
                  </label>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.experienced}
                  onChange={(e) => update(i, { experienced: e.target.checked })}
                  className="mt-0.5 accent-navy"
                />
                <span>
                  経験者です
                  <span className="block text-xs text-muted">
                    中学・高校でバレー部に所属していた（バレーサークルは含みません）
                  </span>
                </span>
              </label>
            </div>
          ))}

          <ErrorText>{error}</ErrorText>
          {done !== null && (
            <p className="text-sm font-medium text-navy">
              {done}人分のエントリーを受け付けました！チームは当日発表します。
            </p>
          )}
          <PrimaryButton type="submit" disabled={busy} className="w-full">
            {busy ? "送信中…" : `${size}人でエントリーする`}
          </PrimaryButton>
          <p className="text-xs text-muted">
            名前・性別・経験者の別は、当日のチーム分けのためだけに使い、他の参加者には公開されません。
          </p>
        </form>
      )}
    </Card>
  );
}
