alter table market_radar.raw_items
  add column if not exists payload_fingerprint text;

update market_radar.raw_items
set payload_fingerprint = md5(payload::text)
where payload_fingerprint is null
  and payload_purged_at is null;

alter table learning_radar.raw_items
  add column if not exists payload_fingerprint text;

update learning_radar.raw_items
set payload_fingerprint = md5(payload::text)
where payload_fingerprint is null
  and payload_purged_at is null;
