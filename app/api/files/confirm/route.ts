import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { logError, logWarning } from '@/lib/utils/logger';
import { validateAuth, validateRequiredFields } from '@/lib/utils/validation';

/**
 * POST /api/files/confirm
 * 
 * Confirms a successful upload and saves file metadata to the database.
 * Called after the browser successfully uploads to the presigned URL.
 * 
 * Request body: { metadata: { uniqueFilename, sanitizedFilename, shortCode, fileSize, mimeType, userId } }
 */
export async function POST(request: NextRequest) {
    let authUserId: string | undefined;
    try {
        // Verify admin authentication
        const supabase = await createClient();
        const userData = await supabase.auth.getUser();
        const user = validateAuth(userData, '/api/files/confirm', 'POST');
        if (user instanceof NextResponse) return user;
        authUserId = user.id;

        // Parse request body
        const body = await request.json();
        const { metadata } = body;

        // Validate required metadata field
        const requiredError = validateRequiredFields(body, ['metadata'], '/api/files/confirm');
        if (requiredError) return requiredError;

        const {
            uniqueFilename,
            sanitizedFilename,
            shortCode,
            fileSize,
            mimeType,
            userId,
            folderId,
        } = metadata;

        // Verify the user confirming is the same user who requested the presign
        if (userId !== user.id) {
            logWarning('/api/files/confirm', 'auth-mismatch', 'User ID mismatch', {
                requestUserId: userId?.substring(0, 8),
                authUserId: user.id.substring(0, 8),
            });
            return NextResponse.json({ error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' }, { status: 401 });
        }

        // Verify the file actually exists in storage
        const adminClient = createAdminClient();
        const { data: fileExists } = await adminClient.storage
            .from('files')
            .list('', {
                search: uniqueFilename,
                limit: 1,
            });

        if (!fileExists || fileExists.length === 0) {
            logWarning('/api/files/confirm', 'storage-check', 'File not found in storage', {
                searchFilename: uniqueFilename.substring(0, 20),
            });
            return NextResponse.json(
                { error: 'File not found in storage. Upload may have failed.', code: 'ERR_FILE_NOT_FOUND' },
                { status: 400 }
            );
        }

        // The target folder must still exist and belong to this owner
        if (folderId) {
            const { data: folder } = await adminClient
                .from('folders')
                .select('id')
                .eq('id', folderId)
                .eq('uploaded_by', user.id)
                .is('deleted_at', null)
                .maybeSingle();
            if (!folder) {
                await adminClient.storage.from('files').remove([uniqueFilename]);
                return NextResponse.json(
                    { error: "That folder doesn't exist any more. Pick another folder and try again.", code: 'ERR_FOLDER_NOT_FOUND' },
                    { status: 404 }
                );
            }
        }

        // Save file metadata to database
        const { data: fileData, error: dbError } = await adminClient
            .from('files')
            .insert({
                filename: uniqueFilename,
                original_filename: sanitizedFilename,
                file_path: uniqueFilename,
                file_size: fileSize,
                mime_type: mimeType,
                short_code: shortCode,
                uploaded_by: user.id,
                folder_id: folderId || null,
            })
            .select()
            .single();

        if (dbError) {
            logError('/api/files/confirm', user.id, 'save-metadata', dbError, {
                filename: sanitizedFilename.substring(0, 20),
                shortCode,
            });
            // Clean up uploaded file since we couldn't save metadata
            await adminClient.storage.from('files').remove([uniqueFilename]);
            return NextResponse.json(
                { error: 'Failed to save file metadata', code: 'ERR_DB_ERROR' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            file: {
                id: fileData.id,
                filename: fileData.filename,
                originalFilename: fileData.original_filename,
                shortCode: fileData.short_code,
                shortUrl: `${env.app.url}/${fileData.short_code}`,
            },
        });
    } catch (error) {
        logError('/api/files/confirm', authUserId, 'confirm-upload', error);
        return NextResponse.json({ error: 'Internal server error', code: 'ERR_CONFIRM' }, { status: 500 });
    }
}
