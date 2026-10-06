-- Migration: Fix Real-time Access Revocation
-- This migration adds REPLICA IDENTITY FULL to the file_access table
-- so that DELETE events include all column data for real-time notifications
-- 
-- Run this in your Supabase SQL Editor to fix the immediate lockout issue

-- Set REPLICA IDENTITY FULL so DELETE events include all columns
-- This is required for real-time access revocation to work properly
ALTER TABLE file_access REPLICA IDENTITY FULL;

-- Ensure the table is in the realtime publication (the initial schema already adds it,
-- and ADD TABLE errors if it is already a member)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'file_access'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE file_access;
  END IF;
END $$;
