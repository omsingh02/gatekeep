-- Migration: Add email notification and public share support to file_access
-- Run this in Supabase SQL Editor

-- Add identifier_type column to distinguish between username and email
ALTER TABLE file_access 
ADD COLUMN IF NOT EXISTS identifier_type TEXT DEFAULT 'username' 
CHECK (identifier_type IN ('email', 'username'));

-- Add notify_on_grant column for email notification preference
ALTER TABLE file_access 
ADD COLUMN IF NOT EXISTS notify_on_grant BOOLEAN DEFAULT false;

-- Add is_public column for password-only public shares (no user identifier required)
ALTER TABLE file_access 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Update existing records to have default values (already handled by DEFAULT)
-- No data migration needed since defaults are applied

-- Add index for potential future email-based queries
CREATE INDEX IF NOT EXISTS idx_file_access_identifier_type 
ON file_access(identifier_type) 
WHERE identifier_type = 'email';

-- Add index for public shares lookup
CREATE INDEX IF NOT EXISTS idx_file_access_is_public
ON file_access(file_id, is_public)
WHERE is_public = true;

-- Comment for documentation
COMMENT ON COLUMN file_access.identifier_type IS 'Type of user identifier: email or username';
COMMENT ON COLUMN file_access.notify_on_grant IS 'Whether to send email notification when access is granted (only applies when identifier_type is email)';
COMMENT ON COLUMN file_access.is_public IS 'Whether this is a public share (password-only, no user identifier required)';
