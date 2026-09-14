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
  inputClass,
} from "@/components/ui";
import { postJson, useSettings } from "@/lib/hooks";

function PhotoLinkEditor({
  initial,
  onSaved,
}: {
  initial: string;
  onSaved: () => void;
}) {
  const [link, setLink] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setLink(initial), [initial]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/admin/settings", "PATCH", { photo_link: link });
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
        <AdminBadge /> 写真リンクの設定
      </p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Googleドライブの共有リンク（https://…）"
        className={inputClass}
        type="url"
      />
      {message && <p className="mt-1 text-sm font-medium">{message}</p>}
      <PrimaryButton onClick={save} disabled={busy} className="mt-2 w-full">
        {busy ? "保存中…" : "保存する"}
      </PrimaryButton>
    </Card>
  );
}

export default function PhotosPage() {
  const { admin } = useAdmin();
  const { data: settings, error, loading, refresh } = useSettings();

  if (error === "unconfigured") return <SetupNotice />;

  const link = settings?.photo_link ?? "";

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>大会写真</SectionTitle>
        {loading ? (
          <EmptyState>読み込み中…</EmptyState>
        ) : link ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              大会の写真は Google ドライブで共有しています。
            </p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block w-full rounded-md bg-navy px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-navy-hover"
            >
              写真を見る ↗
            </a>
          </Card>
        ) : (
          <EmptyState>
            写真はまだ公開されていません。
            <br />
            大会後に運営がリンクを設定します。
          </EmptyState>
        )}
      </section>

      {admin && !loading && (
        <PhotoLinkEditor initial={link} onSaved={refresh} />
      )}
    </div>
  );
}
