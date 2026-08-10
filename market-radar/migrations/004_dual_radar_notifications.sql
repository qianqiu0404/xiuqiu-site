alter table market_radar.outbox
  add column if not exists last_error_message text;

alter table market_radar.delivery_logs
  add column if not exists idempotency_key text;

alter table market_radar.delivery_logs
  add column if not exists error_message text;

update market_radar.delivery_logs logs
set idempotency_key = outbox.idempotency_key
from market_radar.outbox outbox
where logs.outbox_id = outbox.id
  and logs.idempotency_key is null;

create schema if not exists learning_radar;

create table if not exists learning_radar.outbox (
  id text primary key,
  kind text not null check (kind in ('daily')),
  channel text not null default 'weixin',
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'leased', 'sent', 'dead_letter')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_token text,
  lease_until timestamptz,
  last_error text,
  last_error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_radar_outbox_claim_idx
  on learning_radar.outbox (status, available_at, created_at);

create table if not exists learning_radar.delivery_logs (
  id text primary key,
  outbox_id text not null references learning_radar.outbox(id) on delete cascade,
  idempotency_key text not null,
  attempt integer not null,
  status text not null check (status in ('sent', 'failed')),
  provider_message_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists learning_radar_delivery_logs_outbox_idx
  on learning_radar.delivery_logs (outbox_id, created_at desc);
