-- /api/verify counts recent failed guesses per IP and per file to throttle password brute force.
-- Partial indexes keep those counts cheap as access_log grows.
CREATE INDEX IF NOT EXISTS idx_access_log_failures_ip
    ON access_log (ip_address, accessed_at)
    WHERE access_granted = false;

CREATE INDEX IF NOT EXISTS idx_access_log_failures_file
    ON access_log (file_id, accessed_at)
    WHERE access_granted = false;
