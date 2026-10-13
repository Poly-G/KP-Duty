-- Best-effort restrictions for locally owned pg_net installations.
-- Supabase owns the hosted extension and retains its managed function grants.
-- Do not expose net via the Data API; verify net is absent from the exposed Data API schemas.
revoke all on schema net from public,anon,authenticated,service_role;
revoke all on all functions in schema net from public,anon,authenticated,service_role;
revoke all on all tables in schema net from public,anon,authenticated,service_role;
