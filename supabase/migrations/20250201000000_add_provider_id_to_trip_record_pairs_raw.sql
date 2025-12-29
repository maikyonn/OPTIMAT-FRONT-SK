alter table optimat.trip_record_pairs_raw
  add column if not exists provider_id integer;
