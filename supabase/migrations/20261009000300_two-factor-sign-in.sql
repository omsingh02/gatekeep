-- Gatekeep 2.1: two-factor sign-in holds in the database too.
--
-- With two-factor sign-in on, Gatekeep asks for a code from the owner's authenticator app after the
-- password. proxy.ts and validateAuth enforce that in the app, but the anon key is public: with only the
-- password, someone could sign in with supabase-js and use the database API (or Storage) directly. The
-- RESTRICTIVE policies below close that gap. An account with a verified factor needs a session that has
-- entered its code (aal2) to reach any row; accounts without two-factor sign-in are unaffected. They
-- follow Supabase's "enforce MFA for users who have enabled it" pattern. Gatekeep's server uses the
-- service role, which bypasses row-level security, so recipients and the app's own queries don't change.
--
-- A table added to the public schema later needs the same policy (re-running this migration adds it).
-- Safe to run more than once.

-- System status compares this with the version the app expects
CREATE OR REPLACE FUNCTION gatekeep_schema_version()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT '20261009000300'::text $$;

-- The documented pattern reads auth.mfa_factors, which the authenticated role can't read (and shouldn't:
-- it holds the secrets). So the check runs as SECURITY DEFINER, in a schema the API doesn't serve.
-- plpgsql resolves auth.jwt() and auth.mfa_factors when it runs: Supabase Auth creates them, so they're
-- missing from a bare Supabase Postgres (CI's migrations job), where nothing calls this.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.gk_two_factor_ok()
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- aal2 if the account has a verified factor; aal1 (password only) is enough otherwise
  RETURN array[(SELECT auth.jwt() ->> 'aal')] <@ (
    SELECT CASE WHEN count(id) > 0 THEN array['aal2'] ELSE array['aal1', 'aal2'] END
    FROM auth.mfa_factors
    WHERE user_id = (SELECT auth.uid()) AND status = 'verified'
  );
END;
$$;

COMMENT ON FUNCTION private.gk_two_factor_ok() IS
  'Gatekeep: false while an account with two-factor sign-in on has only entered its password (aal1).';

REVOKE ALL ON FUNCTION private.gk_two_factor_ok() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION private.gk_two_factor_ok() FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT USAGE ON SCHEMA private TO authenticated;
    GRANT EXECUTE ON FUNCTION private.gk_two_factor_ok() TO authenticated;
  END IF;
END $$;

-- The function must see every factor. auth.mfa_factors has row-level security on, so a role without
-- BYPASSRLS would see none and quietly let password-only sessions through. Supabase's postgres role has it.
DO $$
BEGIN
  IF to_regclass('auth.mfa_factors') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user
      AND (rolsuper OR rolbypassrls)
      AND has_table_privilege(current_user, 'auth.mfa_factors', 'SELECT')
  ) THEN
    RAISE EXCEPTION 'Run this migration as the postgres role: the two-factor check must be able to read auth.mfa_factors';
  END IF;
END $$;

-- Every public table the signed-in role can reach. (SELECT …) runs the check once per query, not per row.
DO $$
DECLARE
  t regclass;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RETURN;
  END IF;
  FOR t IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'Two-factor sign-in needs the code', t);
    EXECUTE format(
      'CREATE POLICY %I ON %s AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT private.gk_two_factor_ok())) WITH CHECK ((SELECT private.gk_two_factor_ok()))',
      'Two-factor sign-in needs the code', t
    );
  END LOOP;
END $$;

-- Gatekeep's buckets. The server uses the service role, so no policy lets anyone else in today, but a
-- self-hoster may have added some (1.x's schema file suggested a few). Other buckets are left alone.
-- Supabase Storage creates storage.objects, so a bare Postgres doesn't have it.
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NULL OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RETURN;
  END IF;
  DROP POLICY IF EXISTS "Gatekeep buckets need the two-factor code" ON storage.objects;
  CREATE POLICY "Gatekeep buckets need the two-factor code" ON storage.objects
    AS RESTRICTIVE FOR ALL TO authenticated
    USING (bucket_id NOT IN ('files', 'branding') OR (SELECT private.gk_two_factor_ok()))
    WITH CHECK (bucket_id NOT IN ('files', 'branding') OR (SELECT private.gk_two_factor_ok()));
END $$;
