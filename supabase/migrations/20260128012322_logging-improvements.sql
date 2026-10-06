-- Migration: Add denial_reason and request_id columns to access_log
-- These columns support improved debugging and audit trails

-- Add denial_reason column to capture specific failure reasons
ALTER TABLE access_log ADD COLUMN IF NOT EXISTS denial_reason TEXT;

-- Add request_id column for correlating logs across systems
ALTER TABLE access_log ADD COLUMN IF NOT EXISTS request_id TEXT;

-- Add index on request_id for log correlation lookups
CREATE INDEX IF NOT EXISTS idx_access_log_request_id ON access_log(request_id);

-- Comment the columns
COMMENT ON COLUMN access_log.denial_reason IS 'Reason for access denial (e.g., expired, wrong_password, download_limit)';
COMMENT ON COLUMN access_log.request_id IS 'Unique request identifier for correlating with server logs';
