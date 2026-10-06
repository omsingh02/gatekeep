-- Migration: Fix Real-time Access Revocation
-- This migration adds REPLICA IDENTITY FULL to the file_access table
-- so that DELETE events include all column data for real-time notifications
-- 
-- Run this in your Supabase SQL Editor to fix the immediate lockout issue

-- Set REPLICA IDENTITY FULL so DELETE events include all columns
-- This is required for real-time access revocation to work properly
ALTER TABLE file_access REPLICA IDENTITY FULL;

-- Ensure the table is added to realtime publication (idempotent)
ALTER PUBLICATION supabase_realtime ADD TABLE file_access;
