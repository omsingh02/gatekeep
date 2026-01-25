-- Migration: Add safe cascading delete with transaction support
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Add deleted_at column for soft deletes (allows recovery if storage delete fails)
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient queries excluding soft-deleted files
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files(deleted_at) WHERE deleted_at IS NULL;

-- Step 2: Create a function to safely delete a file and all related records
-- This runs in a transaction and returns the filename needed for storage deletion
CREATE OR REPLACE FUNCTION delete_file_cascade(
    p_file_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    filename TEXT,
    error_message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
SET search_path = public
AS $$
DECLARE
    v_filename TEXT;
    v_uploaded_by UUID;
BEGIN
    -- Get file info and verify ownership
    SELECT f.filename, f.uploaded_by 
    INTO v_filename, v_uploaded_by
    FROM files f
    WHERE f.id = p_file_id 
    AND f.deleted_at IS NULL;  -- Exclude already soft-deleted files
    
    -- Check if file exists
    IF v_filename IS NULL THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'File not found'::TEXT;
        RETURN;
    END IF;
    
    -- Verify ownership
    IF v_uploaded_by != p_user_id THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Unauthorized'::TEXT;
        RETURN;
    END IF;
    
    -- Start the cascading delete within this transaction
    -- The CASCADE constraints will handle file_access and access_log
    
    -- Option A: Hard delete (relies on CASCADE constraints)
    DELETE FROM files WHERE id = p_file_id;
    
    -- If we get here, transaction succeeded
    RETURN QUERY SELECT true, v_filename, NULL::TEXT;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Transaction will be rolled back automatically
        RETURN QUERY SELECT false, NULL::TEXT, SQLERRM::TEXT;
END;
$$;

-- Step 3: Create a function for soft delete (marks as deleted but keeps data for recovery)
CREATE OR REPLACE FUNCTION soft_delete_file(
    p_file_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    filename TEXT,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_filename TEXT;
    v_uploaded_by UUID;
BEGIN
    -- Get file info and verify ownership
    SELECT f.filename, f.uploaded_by 
    INTO v_filename, v_uploaded_by
    FROM files f
    WHERE f.id = p_file_id 
    AND f.deleted_at IS NULL;
    
    IF v_filename IS NULL THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'File not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_uploaded_by != p_user_id THEN
        RETURN QUERY SELECT false, NULL::TEXT, 'Unauthorized'::TEXT;
        RETURN;
    END IF;
    
    -- Soft delete: just mark as deleted
    UPDATE files 
    SET deleted_at = NOW()
    WHERE id = p_file_id;
    
    RETURN QUERY SELECT true, v_filename, NULL::TEXT;
END;
$$;

-- Step 4: Create a function to complete deletion after storage is confirmed deleted
CREATE OR REPLACE FUNCTION complete_file_deletion(
    p_file_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only delete if already soft-deleted
    DELETE FROM files 
    WHERE id = p_file_id 
    AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$;

-- Step 5: Create a cleanup function for orphaned soft-deleted files
-- Run this periodically (e.g., daily) to clean up files that were soft-deleted but storage deletion succeeded
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_files(
    older_than_hours INTEGER DEFAULT 24
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM files
        WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - (older_than_hours || ' hours')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION delete_file_cascade(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_file(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_file_deletion(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_soft_deleted_files(INTEGER) TO service_role;

-- Update RLS policies to exclude soft-deleted files from normal queries
DROP POLICY IF EXISTS "Users can view their own files" ON files;
CREATE POLICY "Users can view their own files"
  ON files FOR SELECT
  USING (auth.uid() = uploaded_by AND deleted_at IS NULL);

