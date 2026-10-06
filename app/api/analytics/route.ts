import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAuth } from '@/lib/utils/validation';

export async function GET() {
    try {
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/analytics', 'GET');
        if (user instanceof NextResponse) return user;

        const adminClient = createAdminClient();

        // Get all files for this user (excluding soft-deleted)
        const { data: files } = await adminClient
            .from('files')
            .select('id, original_filename, short_code, created_at')
            .eq('uploaded_by', user.id)
            .is('deleted_at', null);

        if (!files || files.length === 0) {
            return NextResponse.json({ 
                totalFiles: 0,
                recentActivity: [],
                topFiles: []
            });
        }

        const fileIds = files.map((f) => f.id);

        // Get recent access logs (last 50 accesses)
        const { data: recentLogs } = await adminClient
            .from('access_log')
            .select('*')
            .in('file_id', fileIds)
            .order('accessed_at', { ascending: false })
            .limit(50);

        // Get access statistics per file
        const { data: accessStats } = await adminClient
            .from('access_log')
            .select('file_id, access_granted')
            .in('file_id', fileIds);

        // Build file statistics map
        type FileStats = {
            id: string;
            filename: string;
            shortCode: string;
            createdAt: string;
            totalAccesses: number;
            successfulAccesses: number;
            failedAccesses: number;
            uniqueUsers: Set<string>;
        };
        const fileStatsMap = new Map<string, FileStats>();
        files.forEach((file) => {
            fileStatsMap.set(file.id, {
                id: file.id,
                filename: file.original_filename,
                shortCode: file.short_code,
                createdAt: file.created_at,
                totalAccesses: 0,
                successfulAccesses: 0,
                failedAccesses: 0,
                uniqueUsers: new Set<string>(),
            });
        });

        // Calculate statistics
        (accessStats || []).forEach((log) => {
            const stats = fileStatsMap.get(log.file_id);
            if (stats) {
                stats.totalAccesses++;
                if (log.access_granted) {
                    stats.successfulAccesses++;
                } else {
                    stats.failedAccesses++;
                }
            }
        });

        // Get unique users per file from access grants
        const { data: accessGrants } = await adminClient
            .from('file_access')
            .select('file_id, user_identifier')
            .in('file_id', fileIds);

        (accessGrants || []).forEach((grant) => {
            const stats = fileStatsMap.get(grant.file_id);
            // Public grants have no identifier and aren't a user
            if (stats && grant.user_identifier) {
                stats.uniqueUsers.add(grant.user_identifier);
            }
        });

        // Transform recent logs for response
        const recentActivity = (recentLogs || []).map((log) => {
            const file = files.find((f) => f.id === log.file_id);
            return {
                id: log.id,
                fileId: log.file_id,
                filename: file?.original_filename || 'Unknown',
                userIdentifier: log.user_identifier,
                accessGranted: log.access_granted,
                ipAddress: log.ip_address,
                accessedAt: log.accessed_at,
                denialReason: log.denial_reason,
            };
        });

        // Get top files by access count
        const topFiles = Array.from(fileStatsMap.values())
            .map(stats => ({
                ...stats,
                uniqueUsers: stats.uniqueUsers.size,
            }))
            .sort((a, b) => b.totalAccesses - a.totalAccesses)
            .slice(0, 10);

        return NextResponse.json({
            totalFiles: files.length,
            recentActivity,
            topFiles,
        });
    } catch (error) {
        console.error('Analytics error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
