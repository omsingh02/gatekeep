-- Migration: Limit folder nesting to 1 level (root + subfolders only)
-- This ensures folders can only be nested one level deep

-- Add constraint: if a folder has a parent, that parent cannot have a parent
-- This is enforced via a trigger since cross-row constraints aren't possible with CHECK

CREATE OR REPLACE FUNCTION check_folder_depth()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a parent_id, verify the parent has no parent (is a root folder)
    IF NEW.parent_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM folders 
            WHERE id = NEW.parent_id 
            AND parent_id IS NOT NULL
            AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Maximum folder depth is 1 level. Cannot create subfolders inside subfolders.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS enforce_folder_depth ON folders;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER enforce_folder_depth
    BEFORE INSERT OR UPDATE OF parent_id ON folders
    FOR EACH ROW
    EXECUTE FUNCTION check_folder_depth();

-- Verification: Check for any existing violations
DO $$
DECLARE
    violation_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO violation_count
    FROM folders f1
    JOIN folders f2 ON f1.parent_id = f2.id
    WHERE f2.parent_id IS NOT NULL
    AND f1.deleted_at IS NULL
    AND f2.deleted_at IS NULL;
    
    IF violation_count > 0 THEN
        RAISE WARNING 'Found % folders nested more than 1 level deep. These should be moved before enforcing the constraint.', violation_count;
    ELSE
        RAISE NOTICE 'No existing violations found. Folder depth constraint is safe to apply.';
    END IF;
END $$;
