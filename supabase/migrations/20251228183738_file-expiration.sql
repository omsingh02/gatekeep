-- Migration: Add file expiration and cleanup functionality
-- Run this SQL in your Supabase SQL Editor

-- Add expires_at column to files table for automatic file expiration
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster expiration queries
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at) 
WHERE expires_at IS NOT NULL;

-- Function to clean up expired files and access grants
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Delete expired file access grants
    DELETE FROM file_access
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    -- Delete expired session tokens
    UPDATE file_access
    SET session_token = NULL,
        session_expires_at = NULL
    WHERE session_expires_at IS NOT NULL
    AND session_expires_at < NOW();
    
    -- Note: Files with expires_at are NOT auto-deleted here
    -- They should be deleted manually or via a separate process
    -- to allow for proper storage cleanup
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- Uncomment if you have pg_cron enabled:
-- SELECT cron.schedule('cleanup-expired-data', '0 * * * *', 'SELECT cleanup_expired_data()');
