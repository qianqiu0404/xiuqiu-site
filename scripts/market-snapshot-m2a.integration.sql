\set ON_ERROR_STOP on

create temporary table m2_fixture(snapshot jsonb);

insert into m2_fixture
select jsonb_build_object(
  'schemaVersion', 1,
  'universeVersion', 'core-2026-08-v1',
  'snapshotId', 'market-2026-08-12-0000000000000000',
  'asOf', '2026-08-12T08:00:00Z',
  'generatedAt', '2026-08-12T08:00:01Z',
  'mode', 'mixed',
  'quotes', jsonb_build_array(jsonb_build_object(
    'assetId', 'BTC-USDT',
    'role', 'display',
    'price', '120000.1',
    'currency', 'USDT',
    'observedAt', '2026-08-12T08:00:00Z',
    'delaySeconds', 1,
    'provider', 'binance_public',
    'mode', 'live',
    'displayScope', 'private'
  )),
  'coverage', (
    select jsonb_agg(
      jsonb_build_object(
        'assetId', asset_id,
        'status', case when asset_id = 'BTC-USDT' then 'healthy' else 'unavailable' end,
        'marketState', case when asset_id = 'BTC-USDT' then 'open' else 'unknown' end
      ) || case
        when asset_id = 'BTC-USDT' then '{}'::jsonb
        else '{"reason":"provider_not_added_in_m2a"}'::jsonb
      end
      order by ordinal
    )
    from unnest(array[
      'BTC-USDT', 'ETH-USDT', 'SOL-USDT', 'SPY', 'QQQ', 'NVDA', 'MSFT', 'AAPL', 'TSLA', 'COIN', 'GLD',
      '000300', '000016', '399006', '000688', '600519', '300750', '002594', '688981', '601318', 'XAU-USD'
    ]) with ordinality as assets(asset_id, ordinal)
  ),
  'checksum', repeat('0', 64)
);

select status
from market_data.ingest_snapshot(
  (select snapshot from m2_fixture),
  'm2-preview',
  repeat('a', 32),
  now()
);

do $$
declare
  replay_rejected boolean := false;
  partial_rejected boolean := false;
  conflict_rejected boolean := false;
begin
  if (select count(*) from market_data.snapshots) <> 1 then
    raise exception 'snapshot insert was not atomic';
  end if;
  if (select count(*) from market_data.quotes) <> 1 then
    raise exception 'quote count mismatch';
  end if;
  if (select count(*) from market_data.coverage) <> 21 then
    raise exception 'coverage count mismatch';
  end if;
  if (select snapshot_id from market_data.current_snapshot where pointer_key = 'current')
    <> 'market-2026-08-12-0000000000000000' then
    raise exception 'current pointer mismatch';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'market_data'
      and table_name = 'public_current_coverage'
      and column_name in ('price', 'price_text', 'currency', 'provider', 'payload')
  ) then
    raise exception 'public view leaked quote fields';
  end if;
  if (select count(*) from (
    with selected as materialized (
      select s.snapshot_id, s.as_of, s.generated_at, s.mode
      from market_data.current_snapshot c join market_data.snapshots s on s.snapshot_id = c.snapshot_id
      where c.pointer_key = 'current'
    ) select selected.snapshot_id,
      (select count(*) from market_data.quotes q where q.snapshot_id = selected.snapshot_id and q.role = 'display' and q.display_scope = 'private') quote_count,
      (select count(*) from market_data.coverage cv where cv.snapshot_id = selected.snapshot_id) coverage_count
    from selected
  ) atomic_read where quote_count = 1 and coverage_count = 21) <> 1 then
    raise exception 'atomic private read projection failed';
  end if;

  begin
    perform status from market_data.ingest_snapshot(
      (select snapshot from m2_fixture), 'm2-preview', repeat('a', 32), now()
    );
  exception when unique_violation then
    replay_rejected := true;
  end;
  if not replay_rejected then raise exception 'nonce replay unexpectedly succeeded'; end if;

  begin
    perform status from market_data.ingest_snapshot(
      jsonb_set(
        (select snapshot from m2_fixture),
        '{coverage}',
        ((select snapshot->'coverage' from m2_fixture) - 20)
      ),
      'm2-preview', repeat('b', 32), now()
    );
  exception when others then
    partial_rejected := true;
  end;
  if not partial_rejected then raise exception 'partial coverage unexpectedly succeeded'; end if;

  begin
    perform status from market_data.ingest_snapshot(
      jsonb_set((select snapshot from m2_fixture), '{checksum}', to_jsonb(repeat('1', 64))),
      'm2-preview', repeat('c', 32), now()
    );
  exception when others then
    conflict_rejected := true;
  end;
  if not conflict_rejected then raise exception 'snapshot checksum conflict unexpectedly succeeded'; end if;

  if (select count(*) from market_data.snapshots) <> 1
    or (select count(*) from market_data.quotes) <> 1
    or (select count(*) from market_data.coverage) <> 21
    or (select count(*) from market_data.ingest_nonces) <> 1 then
    raise exception 'a rejected ingest left partial rows';
  end if;
end;
$$;

do $$
begin
  if not private_market.consume_rate_limit('oauth:test-client', 2, 600) then
    raise exception 'first login attempt was unexpectedly rejected';
  end if;
  if not private_market.consume_rate_limit('oauth:test-client', 2, 600) then
    raise exception 'second login attempt was unexpectedly rejected';
  end if;
  if private_market.consume_rate_limit('oauth:test-client', 2, 600) then
    raise exception 'persistent login rate limit did not reject the third attempt';
  end if;
end;
$$;

select 'snapshots=' || count(*) from market_data.snapshots;
select 'coverage=' || count(*) from market_data.coverage;
select 'public_columns=' || string_agg(column_name, ',' order by ordinal_position)
from information_schema.columns
where table_schema = 'market_data' and table_name = 'public_current_coverage';
