-- 当日チーム分け（1〜3人）エントリーと、当日のチーム分けのための追加
-- Supabase の SQL Editor に貼り付けて1回だけ実行してください。何度実行しても安全です。

-- チームの種類: entry=チームでのエントリー / guerrilla=個人エントリーから当日編成したチーム
alter table teams add column if not exists kind text not null default 'entry'
  check (kind in ('entry', 'guerrilla'));

-- 個人・少人数エントリー。一緒にエントリーした人は同じ group_id（チーム分けで必ず同じチームにする）
create table if not exists individuals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null default 'none' check (gender in ('female', 'male', 'none')),
  experienced boolean not null default false,
  group_id uuid not null default gen_random_uuid(),
  -- チームに編成されたら、そのチームのID（チームを消すと null に戻る）
  team_id uuid references teams (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 個人の名前・性別などは運営だけが見られるようにする。
-- 閲覧用のポリシーは作らない（= 公開用のキーからは読めない）。読み書きはサーバーだけが行う。
alter table individuals enable row level security;
