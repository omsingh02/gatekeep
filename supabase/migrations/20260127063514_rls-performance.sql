-- Migration: Fix RLS policy performance issues
-- This script fixes the auth_rls_initplan warnings by wrapping auth.uid() in (select ...)
-- Also consolidates duplicate SELECT policies for folders and groups
-- Run this SQL in your Supabase SQL Editor

-- ============================================
-- 1. FILES TABLE: Drop and recreate policies
-- ============================================

DROP POLICY IF EXISTS "Users can view their own files" ON files;
DROP POLICY IF EXISTS "Users can insert their own files" ON files;
DROP POLICY IF EXISTS "Users can update their own files" ON files;
DROP POLICY IF EXISTS "Users can delete their own files" ON files;

CREATE POLICY "Users can view their own files"
  ON files FOR SELECT
  USING ((select auth.uid()) = uploaded_by);

CREATE POLICY "Users can insert their own files"
  ON files FOR INSERT
  WITH CHECK ((select auth.uid()) = uploaded_by);

CREATE POLICY "Users can update their own files"
  ON files FOR UPDATE
  USING ((select auth.uid()) = uploaded_by);

CREATE POLICY "Users can delete their own files"
  ON files FOR DELETE
  USING ((select auth.uid()) = uploaded_by);

-- ============================================
-- 2. FILE_ACCESS TABLE: Drop and recreate policies
-- ============================================

DROP POLICY IF EXISTS "Users can view access grants for their files" ON file_access;
DROP POLICY IF EXISTS "Users can create access grants for their files" ON file_access;
DROP POLICY IF EXISTS "Users can delete access grants for their files" ON file_access;

CREATE POLICY "Users can view access grants for their files"
  ON file_access FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_access.file_id
      AND files.uploaded_by = (select auth.uid())
    )
  );

CREATE POLICY "Users can create access grants for their files"
  ON file_access FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_access.file_id
      AND files.uploaded_by = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete access grants for their files"
  ON file_access FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = file_access.file_id
      AND files.uploaded_by = (select auth.uid())
    )
  );

-- ============================================
-- 3. ACCESS_LOG TABLE: Drop and recreate policies
-- ============================================

DROP POLICY IF EXISTS "Users can view access logs for their files" ON access_log;

CREATE POLICY "Users can view access logs for their files"
  ON access_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM files
      WHERE files.id = access_log.file_id
      AND files.uploaded_by = (select auth.uid())
    )
  );

-- ============================================
-- 4. FOLDERS TABLE: Drop duplicate policies, create unified one
-- ============================================

DROP POLICY IF EXISTS "Users can view their folders" ON folders;
DROP POLICY IF EXISTS "Users can manage their folders" ON folders;

-- Single unified policy for all folder operations
CREATE POLICY "Users can manage their folders"
  ON folders FOR ALL
  USING ((select auth.uid()) = uploaded_by AND deleted_at IS NULL)
  WITH CHECK ((select auth.uid()) = uploaded_by);

-- ============================================
-- 5. GROUPS TABLE: Drop duplicate policies, create unified one
-- ============================================

DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "Users can manage their groups" ON groups;

-- Single unified policy for all group operations
CREATE POLICY "Users can manage their groups"
  ON groups FOR ALL
  USING ((select auth.uid()) = created_by AND deleted_at IS NULL)
  WITH CHECK ((select auth.uid()) = created_by);

-- ============================================
-- 6. GROUP_MEMBERS TABLE: Drop and recreate policies
-- ============================================

DROP POLICY IF EXISTS "Group owners can view members" ON group_members;
DROP POLICY IF EXISTS "Group owners can manage members" ON group_members;

-- Single unified policy for all group member operations
CREATE POLICY "Group owners can manage members"
  ON group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = (select auth.uid())
      AND groups.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = (select auth.uid())
      AND groups.deleted_at IS NULL
    )
  );

-- Done! All RLS policies now use (select auth.uid()) for better performance
-- and duplicate policies have been consolidated.
