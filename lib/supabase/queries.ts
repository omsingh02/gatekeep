import { createAdminClient } from './admin';

/**
 * Eager load pattern - fetch file with access grants and logs in single query
 * Prevents N+1 queries when displaying file details with access grants
 */
export async function getFileWithAccessData(fileId: string, userId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('files')
    .select(`
      id,
      filename,
      original_filename,
      file_size,
      mime_type,
      short_code,
      created_at,
      updated_at,
      file_access (
        id,
        user_identifier,
        access_count,
        download_count,
        max_downloads,
        expires_at,
        last_accessed,
        created_at
      ),
      access_log (
        id,
        access_granted,
        ip_address,
        accessed_at
      )
    `)
    .eq('id', fileId)
    .eq('uploaded_by', userId)
    .is('deleted_at', null)
    .single();

  return { data, error };
}

/**
 * Get file metadata for public access page
 */
export async function getFileByShortCode(shortCode: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('files')
    .select('id, filename, original_filename, file_size, mime_type, short_code, uploaded_by')
    .eq('short_code', shortCode)
    .is('deleted_at', null)
    .single();

  return { data, error };
}

/**
 * Get access data with statistics (optimized for single query)
 * Includes access grants and related log aggregates
 */
export async function getAccessDataWithStats(fileId: string, userIdentifier: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('file_access')
    .select(`
      id,
      file_id,
      user_identifier,
      password_hash,
      access_count,
      download_count,
      max_downloads,
      expires_at,
      last_accessed,
      created_at,
      session_token,
      session_expires_at
    `)
    .eq('file_id', fileId)
    .eq('user_identifier', userIdentifier)
    .maybeSingle();

  return { data, error };
}

/**
 * Batch fetch files with aggregated stats (avoids N+1 queries in analytics)
 */
export async function batchFetchFilesWithStats(userId: string, limit = 20, offset = 0) {
  const admin = createAdminClient();

  const { data, count, error } = await admin
    .from('files')
    .select(`
      id,
      original_filename,
      file_size,
      mime_type,
      short_code,
      created_at,
      access_log(count)
    `, { count: 'exact' })
    .eq('uploaded_by', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return { data, count, error };
}

/**
 * Get analytics data with single aggregated query
 * Instead of fetching all logs and calculating client-side, do it in database
 */
export async function getAnalyticsData(userId: string) {
  const admin = createAdminClient();

  // Get files count and total stats in one query
  const { data: files } = await admin
    .from('files')
    .select(`
      id,
      original_filename,
      short_code,
      file_access(count),
      access_log(count)
    `)
    .eq('uploaded_by', userId)
    .is('deleted_at', null);

  // Get recent activity (last 50 logs)
  const { data: recentLogs } = await admin
    .from('access_log')
    .select(`
      id,
      file_id,
      user_identifier,
      access_granted,
      ip_address,
      accessed_at,
      files(original_filename)
    `)
    .eq('files.uploaded_by', userId)
    .order('accessed_at', { ascending: false })
    .limit(50);

  return { files, recentLogs };
}

/**
 * Check public access grant with all required data in one query
 */
export async function getPublicAccessData(fileId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('file_access')
    .select(`
      id,
      file_id,
      password_hash,
      access_count,
      download_count,
      max_downloads,
      expires_at,
      last_accessed,
      session_token,
      session_expires_at
    `)
    .eq('file_id', fileId)
    .eq('is_public', true)
    .maybeSingle();

  return { data, error };
}
