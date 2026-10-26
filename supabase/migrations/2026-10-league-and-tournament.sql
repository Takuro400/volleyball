-- リーグ戦の自動生成・決勝トーナメント（10チーム）のための追加列
-- すでに schema.sql を実行済みのデータベースで、Supabase の SQL Editor に貼り付けて1回だけ実行してください。
-- 何度実行しても安全です（if not exists）。

-- 勝ち数・得失点差・総得点まで同率のとき、運営が手動で決めた順位（小さいほど上位）
alter table teams add column if not exists manual_rank integer;

-- 決勝トーナメントの試合の位置（リーグ戦は null）
alter table matches add column if not exists slot text
  check (slot in ('R1-1', 'R1-2', 'QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F'));

-- リーグ戦スケジュール自動生成の設定（開始時刻・1試合の枠・コート数）
alter table settings add column if not exists schedule_start text not null default '10:45';
alter table settings add column if not exists slot_minutes integer not null default 15;
alter table settings add column if not exists courts integer not null default 3;
