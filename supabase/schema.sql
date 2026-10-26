-- バレーボール大会アプリ スキーマ
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行してください

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  block text check (block in ('A', 'B', 'C', 'D', 'E')),
  members jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  round text not null default 'league' check (round in ('league', 'bracket')),
  block text check (block in ('A', 'B', 'C', 'D', 'E')),
  team_a uuid references teams (id) on delete cascade,
  team_b uuid references teams (id) on delete cascade,
  score_a integer,
  score_b integer,
  time text,
  court text,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id integer primary key default 1 check (id = 1),
  rules text not null default '',
  photo_link text not null default ''
);

insert into settings (id) values (1) on conflict (id) do nothing;

-- リーグ戦の自動生成・決勝トーナメント用の追加列
-- （既存のデータベースには supabase/migrations/2026-10-league-and-tournament.sql だけを実行すればOK）
alter table teams add column if not exists manual_rank integer;
alter table matches add column if not exists slot text
  check (slot in ('R1-1', 'R1-2', 'QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F'));
alter table settings add column if not exists schedule_start text not null default '10:45';
alter table settings add column if not exists slot_minutes integer not null default 15;
alter table settings add column if not exists courts integer not null default 3;

-- 個人・少人数エントリーと当日のチーム分け用の追加
-- （既存のデータベースには supabase/migrations/2026-10-individual-entries.sql だけを実行すればOK）
alter table teams add column if not exists kind text not null default 'entry'
  check (kind in ('entry', 'guerrilla'));

create table if not exists individuals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null default 'none' check (gender in ('female', 'male', 'none')),
  experienced boolean not null default false,
  group_id uuid not null default gen_random_uuid(),
  team_id uuid references teams (id) on delete set null,
  created_at timestamptz not null default now()
);
-- 個人の名前などは公開しない（閲覧ポリシーを作らない。読み書きはサーバーのみ）
alter table individuals enable row level security;

-- RLS: 全員が閲覧できる共有データ。書き込みはサーバー（service role）経由のみ。
alter table teams enable row level security;
alter table matches enable row level security;
alter table settings enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read settings" on settings for select using (true);
