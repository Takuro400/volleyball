"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/AdminContext";
import {
  AdminBadge,
  Card,
  EmptyState,
  PrimaryButton,
  SectionTitle,
  SetupNotice,
} from "@/components/ui";
import { postJson, useSettings } from "@/lib/hooks";

function RulesEditor({
  initial,
  onSaved,
}: {
  initial: string;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setText(initial), [initial]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/admin/settings", "PATCH", { rules: text });
      setMessage("保存しました");
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-amber bg-amber/10 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <AdminBadge /> ルールを編集
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        className="w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-navy"
        placeholder="ルール・注意事項を入力してください"
      />
      {message && <p className="mt-1 text-sm font-medium">{message}</p>}
      <PrimaryButton onClick={save} disabled={busy} className="mt-2 w-full">
        {busy ? "保存中…" : "保存する"}
      </PrimaryButton>
    </Card>
  );
}

export default function RulesPage() {
  const { admin } = useAdmin();
  const { data: settings, error, loading, refresh } = useSettings();

  if (error === "unconfigured") return <SetupNotice />;

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>ルール・注意事項</SectionTitle>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : settings?.rules ? (
          <Card className="p-5">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {settings.rules}
            </div>
          </Card>
        ) : (
          <EmptyState>ルールはまだ公開されていません</EmptyState>
        )}
      </section>

      {admin && !loading && (
        <RulesEditor initial={settings?.rules ?? ""} onSaved={refresh} />
      )}
    </div>
  );
}
