-- Migration: Remove groups feature from file-share
-- This migration drops all group-related tables, columns, indexes, and constraints.
-- Run this AFTER deploying code that removes group functionality.
-- WARNING: This is a destructive migration. Back up data if needed.

-- 1. Drop group_id column from file_access (removes FK constraint automatically)
ALTER TABLE file_access DROP COLUMN IF EXISTS group_id;

-- 2. Drop constraint that required either user_identifier or group_id
ALTER TABLE file_access DROP CONSTRAINT IF EXISTS file_access_user_or_group;

-- 3. Drop index on group_id
DROP INDEX IF EXISTS idx_file_access_group_id;

-- 4. Drop unique index for file/group combo  
DROP INDEX IF EXISTS idx_file_access_group;

-- 5. Drop trigger for circular reference check
DROP TRIGGER IF EXISTS check_group_circular_ref ON groups;

-- 6. Drop function for circular reference check
DROP FUNCTION IF EXISTS check_group_circular_reference();

-- 7. Drop group_members table
DROP TABLE IF EXISTS group_members;

-- 8. Drop groups table
DROP TABLE IF EXISTS groups;

-- 9. Update file_access constraint to only require user_identifier for non-public shares
-- For non-public shares: user_identifier must be NOT NULL
-- For public shares: user_identifier should be NULL
-- This replaces the old XOR constraint between user_identifier and group_id
ALTER TABLE file_access DROP CONSTRAINT IF EXISTS file_access_public_xor_user;

ALTER TABLE file_access ADD CONSTRAINT file_access_public_xor_user CHECK (
    (is_public = true AND user_identifier IS NULL) OR
    (is_public = false AND user_identifier IS NOT NULL)
);

-- 10. Verify changes
DO $$
BEGIN
    -- Check that groups table no longer exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'groups') THEN
        RAISE EXCEPTION 'groups table still exists - migration failed';
    END IF;
    
    -- Check that group_members table no longer exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'group_members') THEN
        RAISE EXCEPTION 'group_members table still exists - migration failed';
    END IF;
    
    -- Check that group_id column no longer exists in file_access
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'file_access' AND column_name = 'group_id') THEN
        RAISE EXCEPTION 'group_id column still exists in file_access - migration failed';
    END IF;
    
    RAISE NOTICE 'Groups feature successfully removed from database';
END $$;
