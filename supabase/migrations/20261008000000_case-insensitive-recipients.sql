-- Recipient identifiers (emails and usernames) are case-insensitive; the app now lowercases them
-- on save and on unlock. Lowercase existing rows, skipping any that would collide with a grant
-- for the same file that is already stored in lowercase (UNIQUE(file_id, user_identifier)).
UPDATE file_access AS fa
SET user_identifier = lower(fa.user_identifier)
WHERE fa.user_identifier IS NOT NULL
  AND fa.user_identifier <> lower(fa.user_identifier)
  AND NOT EXISTS (
    SELECT 1
    FROM file_access AS other
    WHERE other.file_id = fa.file_id
      AND other.id <> fa.id
      AND other.user_identifier = lower(fa.user_identifier)
  );
