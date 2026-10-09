-- Gatekeep 2.0.1: lock down the database's public API.
--
-- PostgREST serves every function in the public schema at /rest/v1/rpc/<name>, and Supabase grants
-- EXECUTE on new functions to the anon and authenticated roles as well as PUBLIC. The functions below
-- run as SECURITY DEFINER, so they bypass row-level security. They are only for Gatekeep's server,
-- which calls them with the service-role key. 2.0 revoked PUBLIC, which leaves the role grants in
-- place, and 1.x granted two of them to authenticated outright. Anyone holding the public anon key
-- could call them. Safe to run more than once.

-- System status compares this with the version the app expects
CREATE OR REPLACE FUNCTION gatekeep_schema_version()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT '20261009000200'::text $$;

-- Server-only functions: the service role can call them, nobody else
DO $$
DECLARE
  fn regprocedure;
  api_roles text := (
    SELECT string_agg(quote_ident(rolname), ', ')
    FROM pg_roles
    WHERE rolname IN ('anon', 'authenticated')
  );
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'soft_delete_file', 'delete_file_cascade', 'complete_file_deletion', 'cleanup_soft_deleted_files',
        'cleanup_expired_data', 'gk_count_open', 'gk_count_download', 'migrate_v1_to_v2',
        'gatekeep_schema_version'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF api_roles IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s', fn, api_roles);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

-- Functions added later are server-only unless a migration grants them on purpose. Row-level security
-- policies only call auth.* and storage.* functions, so they're unaffected.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
  END IF;
END $$;

-- Signed-out visitors never touch tables directly: recipient pages go through the server. Row-level
-- security already hid every row; this also hides the tables themselves (for example from the GraphQL
-- schema). The owner's signed-in session keeps its access, limited by row-level security as before.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  END IF;
END $$;

-- 1.x let any role insert into the (now read-only) access log. The service role bypasses row-level
-- security, so this policy only ever helped other roles.
DROP POLICY IF EXISTS "Service role can insert access logs" ON access_log;

-- Pin the search path of the two functions that didn't, like every other function
DO $$
BEGIN
  IF to_regprocedure('public.check_folder_depth()') IS NOT NULL THEN
    ALTER FUNCTION public.check_folder_depth() SET search_path = public;
  END IF;
  IF to_regprocedure('public.cleanup_expired_data()') IS NOT NULL THEN
    ALTER FUNCTION public.cleanup_expired_data() SET search_path = public;
  END IF;
END $$;

-- Indexes for foreign keys that had none (deletes and lookups by these columns scan otherwise)
CREATE INDEX IF NOT EXISTS idx_activity_file ON activity (file_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_request_folder ON deliveries (request_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_received_via_delivery ON files (received_via_delivery_id);
CREATE INDEX IF NOT EXISTS idx_files_received_from_recipient ON files (received_from_recipient_id);

-- Same columns as idx_file_access_session_token
DROP INDEX IF EXISTS idx_file_access_sessions;
