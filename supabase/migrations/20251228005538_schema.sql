-- File Sharing Application Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File access table
CREATE TABLE IF NOT EXISTS file_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id, user_identifier)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_files_short_code ON files(short_code);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_file_access_file_id ON file_access(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_user_identifier ON file_access(user_identifier);

-- Enable Realtime for file_access table (for instant revocation notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE file_access;

-- Set REPLICA IDENTITY FULL so DELETE events include all columns
-- This is required for real-time access revocation to work properly
ALTER TABLE file_access REPLICA IDENTITY FULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for files table
DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on tables
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_access ENABLE ROW LEVEL SECURITY;

-- Files policies
-- Admin can see their own files
CREATE POLICY "Users can view their own files"
  ON files FOR SELECT
  USING (auth.uid() = uploaded_by);

-- Admin can insert their own files
CREATE POLICY "Users can insert their own files"
  ON files FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

-- Admin can update their own files
CREATE POLICY "Users can update their own files"
  ON files FOR UPDATE
  USING (auth.uid() = uploaded_by);

-- Admin can delete their own files
CREATE POLICY "Users can delete their own files"
  ON files FOR DELETE
  USING (auth.uid() = uploaded_by);

-- File access policies
-- Admin can view access grants for their files
CREATE POLICY "Users can view access grants for their files"
  ON file_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_access.file_id
      AND files.uploaded_by = auth.uid()
    )
  );

-- Admin can create access grants for their files
CREATE POLICY "Users can create access grants for their files"
  ON file_access FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_access.file_id
      AND files.uploaded_by = auth.uid()
    )
  );

-- Admin can delete access grants for their files
CREATE POLICY "Users can delete access grants for their files"
  ON file_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_access.file_id
      AND files.uploaded_by = auth.uid()
    )
  );

-- Create storage bucket for files
-- Note: Run this in the Supabase Storage section, not SQL editor
-- INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', false);

-- Storage policies (run after creating the bucket)
-- CREATE POLICY "Authenticated users can upload files"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'files' AND auth.role() = 'authenticated');

-- CREATE POLICY "Users can view files they have access to"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'files');

-- CREATE POLICY "Users can delete their own files"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);
