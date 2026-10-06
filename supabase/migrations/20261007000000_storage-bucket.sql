-- Private bucket for uploaded files. The app only touches it with the service-role key
-- (presigned uploads, short-lived signed downloads), so no storage policies are needed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;
