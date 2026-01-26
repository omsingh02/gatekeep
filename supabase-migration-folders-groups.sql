-- Migration: Add folders and static groups for access control
-- Run this SQL in your Supabase SQL Editor

-- Ensure updated_at helper exists (defined in base schema)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) Folders (hierarchical)
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_name
  ON folders(uploaded_by, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_uploaded_by ON folders(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at ON folders(deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Link files to folders (nullable, keeps existing files valid)
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id);

-- 2) Groups (static, admin-managed)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_owner_name
  ON groups(created_by, lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups(deleted_at) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Group members (static list of identifiers)
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  member_identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, member_identifier)
);

CREATE INDEX IF NOT EXISTS idx_group_members_identifier ON group_members(member_identifier);

-- 3) File access grants can target a user OR a group (exclusive)
ALTER TABLE file_access
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

ALTER TABLE file_access
  ALTER COLUMN user_identifier DROP NOT NULL;

ALTER TABLE file_access
  ADD CONSTRAINT file_access_user_or_group
  CHECK ((user_identifier IS NOT NULL) <> (group_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_file_access_group_id ON file_access(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_access_file_group
  ON file_access(file_id, group_id)
  WHERE group_id IS NOT NULL;

-- 4) Row Level Security for new tables
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Folders: owner-only
CREATE POLICY "Users can view their folders"
  ON folders FOR SELECT
  USING (auth.uid() = uploaded_by AND deleted_at IS NULL);

CREATE POLICY "Users can manage their folders"
  ON folders FOR ALL
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- Groups: owner-only
CREATE POLICY "Users can view their groups"
  ON groups FOR SELECT
  USING (auth.uid() = created_by AND deleted_at IS NULL);

CREATE POLICY "Users can manage their groups"
  ON groups FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Group members: owner of group only
CREATE POLICY "Group owners can view members"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
      AND groups.deleted_at IS NULL
    )
  );

CREATE POLICY "Group owners can manage members"
  ON group_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
      AND groups.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
      AND groups.deleted_at IS NULL
    )
  );
