-- Migration: Add access tokens to file_access table
-- This allows session management without storing passwords client-side
-- Run this SQL in your Supabase SQL Editor

-- Add session_token and session_expires_at columns
ALTER TABLE file_access 
ADD COLUMN IF NOT EXISTS session_token TEXT,
ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_file_access_session_token ON file_access(session_token) 
WHERE session_token IS NOT NULL;

-- Optional: Clean up expired sessions (run periodically via cron job or Edge Function)
-- DELETE FROM file_access 
-- WHERE session_expires_at IS NOT NULL 
-- AND session_expires_at < NOW();
