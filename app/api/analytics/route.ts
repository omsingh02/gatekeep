import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        const fileIds = (files as any[]).map((f: any) => f.id);

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
        const fileStatsMap = new Map();
        (files as any[]).forEach((file: any) => {
            fileStatsMap.set(file.id, {
                id: file.id,
                filename: file.original_filename,
                shortCode: file.short_code,
                createdAt: file.created_at,
                totalAccesses: 0,
                successfulAccesses: 0,
                failedAccesses: 0,
                uniqueUsers: new Set(),
            });
        });

        // Calculate statistics
        (accessStats || []).forEach((log: any) => {
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

        (accessGrants || []).forEach((grant: any) => {
            const stats = fileStatsMap.get(grant.file_id);
            if (stats) {
                stats.uniqueUsers.add(grant.user_identifier);
            }
        });

        // Transform recent logs for response
        const recentActivity = (recentLogs || []).map((log: any) => {
            const file = (files as any[]).find((f: any) => f.id === log.file_id);
            return {
                id: log.id,
                fileId: log.file_id,
                filename: file?.original_filename || 'Unknown',
                userIdentifier: log.user_identifier,
                accessGranted: log.access_granted,
                ipAddress: log.ip_address,
                accessedAt: log.accessed_at,
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
