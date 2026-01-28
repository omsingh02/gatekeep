-- Migration: Fix public share constraint to allow public access grants
-- Run this in Supabase SQL Editor
--
-- Issue: The file_access_user_or_group constraint prevents public shares
-- where both user_identifier and group_id are NULL.
--
-- This migration updates the constraint to allow public shares.

-- Drop the old constraint
ALTER TABLE file_access 
DROP CONSTRAINT IF EXISTS file_access_user_or_group;

-- Add updated constraint that allows public shares
ALTER TABLE file_access
  ADD CONSTRAINT file_access_user_or_group_or_public
  CHECK (
    -- Public shares: is_public=true and both identifiers are null
    (is_public = true AND user_identifier IS NULL AND group_id IS NULL) OR
    -- Non-public shares: exactly one of user_identifier or group_id is not null
    (is_public = false AND (user_identifier IS NOT NULL) <> (group_id IS NOT NULL))
  );

-- Comment for documentation
COMMENT ON CONSTRAINT file_access_user_or_group_or_public ON file_access IS 
  'Ensures public shares have no identifiers, and non-public shares have exactly one identifier (user or group)';
