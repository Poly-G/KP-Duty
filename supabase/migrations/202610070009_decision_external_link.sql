-- Allow migration/source mapping for decision records.
alter type public.integration_entity_type
  add value if not exists 'decision';
