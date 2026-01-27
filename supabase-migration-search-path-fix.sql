-- Migration: Fix function search_path security warnings
-- These functions need explicit search_path to prevent mutable search_path attacks

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Fix check_group_circular_reference function  
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
    
    SELECT parent_id INTO current_id FROM public.groups WHERE id = current_id;
    depth := depth + 1;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
