-- Run once in Supabase: SQL Editor → New query → paste → Run.
create table if not exists enrichment (
  request_id text primary key,
  category text not null,
  confidence real not null,
  lang text not null,
  translation text,
  action text not null,
  draft text not null,
  draft_translation text,
  model text not null,
  created_at timestamptz not null default now()
);

create table if not exists request_status (
  request_id text primary key,
  status text not null,
  updated_at timestamptz not null default now()
);

-- No policies: only the server's service-role key (which bypasses RLS) can
-- read or write these tables; the public anon key gets nothing.
alter table enrichment enable row level security;
alter table request_status enable row level security;
