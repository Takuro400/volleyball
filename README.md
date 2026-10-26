# バレーボール大会 運営アプリ

九州工業大学・西南女学院大学の1年生向けバレーボール大会（2026年11月27日(金) 10:00〜16:00、折尾スポーツセンター）の運営用 Web アプリです。

- **フレームワーク**: Next.js (App Router) + Tailwind CSS
- **データベース**: Supabase（teams / matches / settings）
- **デプロイ先**: Vercel

## 機能

| 画面 | 一般ユーザー | 運営（合言葉でロック解除） |
| --- | --- | --- |
| ホーム | カウントダウン・開催概要・エントリー数 | – |
| エントリー | チーム登録（最大15チーム）／当日チーム分けで参加（1〜3人組・最大30人、同じ組は必ず同じチーム）、チーム一覧 | ブロックのランダム割当 |
| 結果・順位 | ブロック別順位表（自動ソート）・試合結果 | 対戦カード追加・スコア入力 |
| トーナメント | 初戦の組み合わせ自動生成（1位vs4位・2位vs3位） | 初戦の試合登録 |
| 試合予定 | チーム選択で次の試合の時間・コート表示 | 予定の登録 |
| ルール | ルール・注意事項の閲覧 | 編集・保存 |
| 写真 | 「写真を見る」ボタン | Googleドライブリンクの設定 |

運営者モードはヘッダー右上の「⚿ 運営」から合言葉を入力してロック解除します。
シミュレーション用のダミーデータ投入・全データリセットは **開発環境限定** です（本番では表示されず、APIも拒否します）。

## セットアップ

### 1. Supabase プロジェクトを作成

1. [supabase.com](https://supabase.com) で新規プロジェクトを作成
2. ダッシュボードの **SQL Editor** で [`supabase/schema.sql`](supabase/schema.sql) の内容を貼り付けて実行
3. **Project Settings → API** で以下の3つを控える
   - Project URL
   - `anon` public キー
   - `service_role` キー（秘密。サーバーでのみ使用）

### 2. 環境変数を設定

```bash
cp .env.local.example .env.local
```

`.env.local` を開いて値を設定します:

| 変数 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public キー |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role キー |
| `ADMIN_PASSPHRASE` | 運営者モードの合言葉（自由に決める） |

### 3. ローカルで起動

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

## Vercel へのデプロイ

1. このリポジトリを GitHub に push
2. [vercel.com](https://vercel.com) で **New Project** → リポジトリをインポート
3. **Environment Variables** に `.env.local` と同じ4つの変数を設定
4. **Deploy**

以降は `main` ブランチに push するたびに自動でデプロイされます。

## 設計メモ

- **読み取り**: 全データ（エントリー・結果・順位など）は共有データとして anon キーでクライアントから直接取得します。RLS で読み取りのみ許可しています。
- **書き込み**: すべて Next.js の Route Handler（`src/app/api/`）経由で、サーバー側の service_role キーを使って行います。運営操作は httpOnly Cookie で保護しています。
- **認証の差し替え**: 運営判定は [`src/lib/admin-auth.ts`](src/lib/admin-auth.ts) の `isAdminRequest()` に集約してあり、運営 UI もコンポーネント単位（`AdminPanel` / `AddMatchForm` / `ScheduleForm` / `RulesEditor` / `PhotoLinkEditor`）で分離しているので、将来 Supabase Auth に置き換える場合はこの1関数とログインモーダルを差し替えるだけで済みます。
- **順位計算**: [`src/lib/standings.ts`](src/lib/standings.ts)。勝ち数 → 得失点差 → 総得点 → チーム名の順でソート。リーグ戦は各チーム2試合・15点先取（デュースなし）を想定しています。

