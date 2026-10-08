-- Atomic counters for deliveries. A download is only counted while it is under the
-- recipient's limit, in one statement, so two parallel downloads can't both slip past it.

-- Returns the new download count, or -1 when the recipient may not download (limit reached,
-- access ended or removed).
CREATE OR REPLACE FUNCTION gk_count_download(p_recipient_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE delivery_recipients
    SET download_count = download_count + 1,
        last_opened_at = now()
    WHERE id = p_recipient_id
      AND removed_at IS NULL
      AND (ends_at IS NULL OR ends_at > now())
      AND (download_limit IS NULL OR download_count < download_limit)
    RETURNING download_count
  )
  SELECT coalesce((SELECT download_count FROM updated), -1);
$$;

-- Records an open: bumps open_count and last_opened_at, returns the new open count.
CREATE OR REPLACE FUNCTION gk_count_open(p_recipient_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE delivery_recipients
  SET open_count = open_count + 1,
      last_opened_at = now()
  WHERE id = p_recipient_id
  RETURNING open_count;
$$;

REVOKE ALL ON FUNCTION gk_count_download(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION gk_count_open(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION gk_count_download(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION gk_count_open(uuid) TO service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION gatekeep_schema_version()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT '20261009000100'::text $$;
