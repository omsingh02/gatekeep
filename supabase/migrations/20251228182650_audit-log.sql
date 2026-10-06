-- Migration: Add audit logging for file access
-- Run this SQL in your Supabase SQL Editor

-- Create access_log table for tracking all file access attempts
CREATE TABLE IF NOT EXISTS access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  access_granted BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_access_log_file_id ON access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_access_log_user_identifier ON access_log(user_identifier);
CREATE INDEX IF NOT EXISTS idx_access_log_accessed_at ON access_log(accessed_at);

-- Add download tracking to file_access table
ALTER TABLE file_access 
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_downloads INTEGER;

-- Create index for expires_at for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_file_access_expires_at ON file_access(expires_at) 
WHERE expires_at IS NOT NULL;

-- RLS policies for access_log
ALTER TABLE access_log ENABLE ROW LEVEL SECURITY;

-- Admin can view access logs for their files
CREATE POLICY "Users can view access logs for their files"
  ON access_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = access_log.file_id
      AND files.uploaded_by = auth.uid()
    )
  );

-- Service role can insert access logs (via API)
CREATE POLICY "Service role can insert access logs"
  ON access_log FOR INSERT
  WITH CHECK (true);
