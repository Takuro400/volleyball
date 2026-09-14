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

-- RLS: 全員が閲覧できる共有データ。書き込みはサーバー（service role）経由のみ。
alter table teams enable row level security;
alter table matches enable row level security;
alter table settings enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read settings" on settings for select using (true);
