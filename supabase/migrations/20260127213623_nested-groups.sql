-- Migration: Add nested groups support (hierarchical groups)
-- Run this SQL in your Supabase SQL Editor

-- 1) Add parent_id column to groups table for nesting
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 2) Create indexes for nested groups
CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_id);

-- Update unique constraint to include parent_id (name unique within same parent)
DROP INDEX IF EXISTS idx_groups_owner_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_owner_parent_name
  ON groups(created_by, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE deleted_at IS NULL;

-- 3) Helper function to check for circular references
CREATE OR REPLACE FUNCTION check_group_circular_reference()
RETURNS TRIGGER AS $$
DECLARE
  current_id UUID;
  max_depth INTEGER := 100;
  depth INTEGER := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Cannot be own parent
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Group cannot be its own parent';
  END IF;
  
  -- Check for circular reference by walking up the tree
  current_id := NEW.parent_id;
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular reference detected in group hierarchy';
    END IF;
    
    SELECT parent_id INTO current_id FROM groups WHERE id = current_id;
    depth := depth + 1;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_group_circular_ref ON groups;
CREATE TRIGGER check_group_circular_ref
  BEFORE INSERT OR UPDATE OF parent_id ON groups
  FOR EACH ROW
  EXECUTE FUNCTION check_group_circular_reference();
