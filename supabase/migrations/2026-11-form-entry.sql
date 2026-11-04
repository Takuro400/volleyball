-- Googleフォームでのエントリー受付のための追加
-- Supabase の SQL Editor に貼り付けて1回だけ実行してください。何度実行しても安全です。

-- エントリーの受付方法: form=Googleフォームで受け付ける（アプリ内のフォームは閉じる） / app=アプリ内のフォームで受け付ける
alter table settings add column if not exists entry_mode text not null default 'form'
  check (entry_mode in ('form', 'app'));

-- Googleフォームのリンク（チーム用 / 当日チーム分け用）。運営がアプリ内で設定する
alter table settings add column if not exists form_team_url text not null default '';
alter table settings add column if not exists form_individual_url text not null default '';
