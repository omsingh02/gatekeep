-- Gatekeep 2.1.1: two database fixes. Safe to run more than once.

-- System status compares this with the version the app expects
CREATE OR REPLACE FUNCTION gatekeep_schema_version()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT '20261009000400'::text $$;

-- 1. A deleted folder's name can be used again. Folders are soft-deleted, and the unique index on
--    (owner, parent, lower(name)) also covered deleted folders, so reusing the name failed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_live_name
  ON folders (uploaded_by, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS idx_folders_unique_name;

-- 2. File count and storage used, summed in the database. The database API returns at most 1,000 rows
--    per request, so adding sizes up in the app undercounted larger libraries.
CREATE OR REPLACE FUNCTION gk_library_totals(p_owner uuid)
RETURNS TABLE (file_count bigint, total_size bigint)
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT count(*), COALESCE(sum(file_size), 0)::bigint
  FROM public.files
  WHERE uploaded_by = p_owner AND deleted_at IS NULL
$$;

-- Server-only, like every other function (see 20261009000200)
REVOKE ALL ON FUNCTION gk_library_totals(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION gk_library_totals(uuid) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION gk_library_totals(uuid) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION gk_library_totals(uuid) TO service_role;
  END IF;
END $$;
