-- Explicit grants for the service_role key.
--
-- Supabase historically auto-granted full access to service_role on table
-- creation. That auto-grant is being removed (new projects 2026-05-30; all
-- projects 2026-10-30). The service_role key bypasses RLS but still needs
-- table-level GRANTs to satisfy PostgREST.
--
-- We grant ONLY to service_role — never anon/authenticated. RLS has no
-- policies on these tables, so even if the anon key leaked, no rows are
-- reachable. This migration keeps that boundary intact while making the
-- grants explicit and durable.

-- Schema-level: lets service_role see the schema exists.
grant usage on schema app to service_role;

-- Existing tables: full CRUD for service_role.
grant select, insert, update, delete on all tables    in schema app to service_role;
grant usage, select                   on all sequences in schema app to service_role;
grant execute                         on all functions in schema app to service_role;

-- Future tables/sequences/functions created in this schema inherit the same grants
-- so we don't have to remember every time we add a table.
alter default privileges in schema app
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema app
  grant usage, select on sequences to service_role;

alter default privileges in schema app
  grant execute on functions to service_role;

-- Belt-and-braces: explicitly revoke from anon and authenticated. They
-- shouldn't have anything anyway because the schema isn't in their default
-- search path, but this makes the intent unmistakable if the schema is
-- ever exposed differently in the future.
revoke all on schema app                                  from anon, authenticated;
revoke all on all tables    in schema app                 from anon, authenticated;
revoke all on all sequences in schema app                 from anon, authenticated;
revoke all on all functions in schema app                 from anon, authenticated;
alter default privileges in schema app revoke all on tables    from anon, authenticated;
alter default privileges in schema app revoke all on sequences from anon, authenticated;
alter default privileges in schema app revoke all on functions from anon, authenticated;
