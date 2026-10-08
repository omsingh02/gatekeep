-- Gatekeep v2: deliveries are the unit of sharing.
-- See docs/decisions/0001-deliveries.md. Safe to re-run: every object is created IF NOT EXISTS,
-- and migrate_v1_to_v2() skips rows it has already copied.

-- ---------------------------------------------------------------------------
-- Files no longer get a link of their own (deliveries do). v1 links keep their
-- code through the delivery that migrate_v1_to_v2() creates for them.
-- ---------------------------------------------------------------------------
ALTER TABLE files ALTER COLUMN short_code DROP NOT NULL;

-- Files that arrive through a request remember where they came from
ALTER TABLE files ADD COLUMN IF NOT EXISTS received_via_delivery_id uuid;
ALTER TABLE files ADD COLUMN IF NOT EXISTS received_from_recipient_id uuid;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_code text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'send' CHECK (kind IN ('send', 'request')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  request_folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
  request_max_files int CHECK (request_max_files IS NULL OR request_max_files > 0),
  request_max_file_mb int CHECK (request_max_file_mb IS NULL OR request_max_file_mb > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_deliveries_owner_created
  ON deliveries (owner_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE files DROP CONSTRAINT IF EXISTS files_received_via_delivery_fkey;
ALTER TABLE files ADD CONSTRAINT files_received_via_delivery_fkey
  FOREIGN KEY (received_via_delivery_id) REFERENCES deliveries(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS delivery_files (
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (delivery_id, file_id)
);
CREATE INDEX IF NOT EXISTS idx_delivery_files_file ON delivery_files (file_id);

CREATE TABLE IF NOT EXISTS delivery_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'person' CHECK (kind IN ('person', 'anyone')),
  identifier text,
  identifier_type text CHECK (identifier_type IN ('email', 'username')),
  method text NOT NULL CHECK (method IN ('email_code', 'password')),
  password_hash text,
  ends_at timestamptz,
  download_limit int CHECK (download_limit IS NULL OR download_limit > 0),
  download_count int NOT NULL DEFAULT 0,
  open_count int NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  session_token_hash text,
  session_expires_at timestamptz,
  removed_at timestamptz,
  ending_notice_sent_at timestamptz,
  legacy_access_id uuid UNIQUE,            -- v1 file_access.id (dropped in v2.1)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_recipients_identity CHECK (
    (kind = 'anyone' AND identifier IS NULL AND identifier_type IS NULL AND method = 'password')
    OR (kind = 'person' AND identifier IS NOT NULL AND identifier = lower(identifier) AND identifier_type IS NOT NULL)
  ),
  CONSTRAINT delivery_recipients_method CHECK (
    (method = 'password' AND password_hash IS NOT NULL)
    OR (method = 'email_code' AND identifier_type = 'email')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_recipients_person
  ON delivery_recipients (delivery_id, identifier) WHERE identifier IS NOT NULL AND removed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_recipients_anyone
  ON delivery_recipients (delivery_id) WHERE kind = 'anyone' AND removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_recipients_delivery ON delivery_recipients (delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_recipients_session
  ON delivery_recipients (session_token_hash) WHERE session_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_recipients_ending
  ON delivery_recipients (ends_at) WHERE ends_at IS NOT NULL AND removed_at IS NULL;

ALTER TABLE files DROP CONSTRAINT IF EXISTS files_received_from_recipient_fkey;
ALTER TABLE files ADD CONSTRAINT files_received_from_recipient_fkey
  FOREIGN KEY (received_from_recipient_id) REFERENCES delivery_recipients(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES delivery_recipients(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verification_codes_recipient
  ON verification_codes (recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES delivery_recipients(id) ON DELETE SET NULL,
  file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'opened', 'previewed', 'downloaded', 'downloaded_all', 'denied', 'code_sent',
    'uploaded', 'access_given', 'access_removed', 'invite_sent'
  )),
  reason text CHECK (reason IS NULL OR reason IN (
    'wrong_password', 'wrong_code', 'not_on_delivery', 'ended', 'download_limit',
    'removed', 'throttled', 'code_expired', 'session_ended'
  )),
  actor text,
  ip text,
  user_agent text,
  request_id text,
  notified_at timestamptz,                 -- set on the row that triggered an owner email
  legacy_log_id uuid UNIQUE,               -- v1 access_log.id (dropped in v2.1)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_owner_created ON activity (owner_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_delivery_created ON activity (delivery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_recipient_created ON activity (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_denied_ip
  ON activity (ip, created_at) WHERE type IN ('denied', 'code_sent');

CREATE TABLE IF NOT EXISTS owner_settings (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 80),
  organization text CHECK (organization IS NULL OR char_length(organization) <= 80),
  logo_path text,
  recipient_message text CHECK (recipient_message IS NULL OR char_length(recipient_message) <= 500),
  default_method text NOT NULL DEFAULT 'email_code' CHECK (default_method IN ('email_code', 'password')),
  default_ends_in_days int CHECK (default_ends_in_days IS NULL OR default_ends_in_days > 0),
  default_download_limit int CHECK (default_download_limit IS NULL OR default_download_limit > 0),
  notify_opened boolean NOT NULL DEFAULT true,
  notify_downloaded boolean NOT NULL DEFAULT false,
  notify_denied boolean NOT NULL DEFAULT true,
  notify_uploaded boolean NOT NULL DEFAULT true,
  homepage text NOT NULL DEFAULT 'branded' CHECK (homepage IN ('landing', 'branded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_delivery_recipients_updated_at ON delivery_recipients;
CREATE TRIGGER update_delivery_recipients_updated_at BEFORE UPDATE ON delivery_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_owner_settings_updated_at ON owner_settings;
CREATE TRIGGER update_owner_settings_updated_at BEFORE UPDATE ON owner_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row-level security. The app uses the service role on the server; these policies
-- keep direct (anon/authenticated) access owner-scoped. verification_codes has no
-- policies at all: only the service role may touch it.
-- ---------------------------------------------------------------------------
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE owner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their deliveries" ON deliveries;
CREATE POLICY "Owners manage their deliveries" ON deliveries
  FOR ALL USING ((select auth.uid()) = owner_id) WITH CHECK ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Owners manage files in their deliveries" ON delivery_files;
CREATE POLICY "Owners manage files in their deliveries" ON delivery_files
  FOR ALL USING (EXISTS (
    SELECT 1 FROM deliveries d WHERE d.id = delivery_files.delivery_id AND d.owner_id = (select auth.uid())
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM deliveries d WHERE d.id = delivery_files.delivery_id AND d.owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Owners manage recipients of their deliveries" ON delivery_recipients;
CREATE POLICY "Owners manage recipients of their deliveries" ON delivery_recipients
  FOR ALL USING (EXISTS (
    SELECT 1 FROM deliveries d WHERE d.id = delivery_recipients.delivery_id AND d.owner_id = (select auth.uid())
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM deliveries d WHERE d.id = delivery_recipients.delivery_id AND d.owner_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Owners read their activity" ON activity;
CREATE POLICY "Owners read their activity" ON activity
  FOR SELECT USING ((select auth.uid()) = owner_id);

DROP POLICY IF EXISTS "Owners manage their settings" ON owner_settings;
CREATE POLICY "Owners manage their settings" ON owner_settings
  FOR ALL USING ((select auth.uid()) = owner_id) WITH CHECK ((select auth.uid()) = owner_id);

-- Live removal: open delivery pages watch their recipient row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'delivery_recipients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE delivery_recipients;
  END IF;
END $$;
ALTER TABLE delivery_recipients REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- Public bucket for the owner's logo (shown on recipient pages and in emails)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Schema version, read by /api/status to detect missing migrations
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gatekeep_schema_version()
RETURNS text
LANGUAGE sql STABLE
SET search_path = ''
AS $$ SELECT '20261009000000'::text $$;

-- ---------------------------------------------------------------------------
-- v1 → v2 data: every v1 file link becomes a one-file delivery with the same code,
-- every v1 grant becomes a password recipient, and the v1 access log becomes
-- activity. Re-runnable: legacy ids make each copy happen once. The seed script
-- calls it again after inserting demo v1 data.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION migrate_v1_to_v2()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. One delivery per v1 file link, keeping the code
  INSERT INTO deliveries (owner_id, short_code, kind, title, created_at, updated_at)
  SELECT f.uploaded_by, f.short_code, 'send', left(f.original_filename, 200),
         coalesce(f.created_at, now()), coalesce(f.updated_at, now())
  FROM files f
  WHERE f.short_code IS NOT NULL AND f.deleted_at IS NULL
  ON CONFLICT (short_code) DO NOTHING;

  INSERT INTO delivery_files (delivery_id, file_id, position)
  SELECT d.id, f.id, 0
  FROM files f
  JOIN deliveries d ON d.short_code = f.short_code AND d.owner_id = f.uploaded_by
  WHERE f.deleted_at IS NULL
  ON CONFLICT DO NOTHING;

  -- 2. v1 grants → password recipients. Sessions are not carried over: recipients unlock once more.
  INSERT INTO delivery_recipients (
    delivery_id, kind, identifier, identifier_type, method, password_hash,
    ends_at, download_limit, download_count, open_count, last_opened_at, created_at, legacy_access_id
  )
  SELECT
    d.id,
    CASE WHEN fa.is_public THEN 'anyone' ELSE 'person' END,
    CASE WHEN fa.is_public THEN NULL ELSE lower(fa.user_identifier) END,
    CASE WHEN fa.is_public THEN NULL
         ELSE coalesce(fa.identifier_type, CASE WHEN fa.user_identifier LIKE '%@%' THEN 'email' ELSE 'username' END)
    END,
    'password',
    fa.password_hash,
    fa.expires_at,
    CASE WHEN fa.max_downloads >= 1 THEN fa.max_downloads END,
    coalesce(fa.download_count, 0),
    coalesce(fa.access_count, 0),
    fa.last_accessed,
    coalesce(fa.created_at, now()),
    fa.id
  FROM file_access fa
  JOIN files f ON f.id = fa.file_id AND f.deleted_at IS NULL
  JOIN deliveries d ON d.short_code = f.short_code AND d.owner_id = f.uploaded_by
  WHERE (fa.is_public OR fa.user_identifier IS NOT NULL)
  ON CONFLICT DO NOTHING;

  -- 3. v1 access log → activity
  INSERT INTO activity (
    owner_id, delivery_id, recipient_id, file_id, type, reason, actor, ip, user_agent, request_id,
    created_at, legacy_log_id
  )
  SELECT
    f.uploaded_by,
    d.id,
    (SELECT r.id FROM delivery_recipients r
      WHERE r.delivery_id = d.id
        AND ((al.user_identifier = 'public' AND r.kind = 'anyone') OR r.identifier = lower(al.user_identifier))
      ORDER BY r.created_at LIMIT 1),
    f.id,
    CASE WHEN al.access_granted THEN 'opened' ELSE 'denied' END,
    CASE WHEN al.access_granted THEN NULL
         ELSE CASE al.denial_reason
           WHEN 'wrong_password' THEN 'wrong_password'
           WHEN 'no_access_grant' THEN 'not_on_delivery'
           WHEN 'expired' THEN 'ended'
           WHEN 'download_limit' THEN 'download_limit'
           WHEN 'invalid_session' THEN 'session_ended'
           WHEN 'session_expired' THEN 'session_ended'
         END
    END,
    CASE WHEN al.user_identifier = 'public' THEN NULL ELSE lower(al.user_identifier) END,
    al.ip_address,
    al.user_agent,
    al.request_id,
    coalesce(al.accessed_at, now()),
    al.id
  FROM access_log al
  JOIN files f ON f.id = al.file_id
  LEFT JOIN deliveries d ON d.short_code = f.short_code AND d.owner_id = f.uploaded_by
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION migrate_v1_to_v2() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION migrate_v1_to_v2() TO service_role;
  END IF;
END $$;

SELECT migrate_v1_to_v2();
