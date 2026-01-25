import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

/**
 * POST /api/files/confirm
 * 
 * Confirms a successful upload and saves file metadata to the database.
 * Called after the browser successfully uploads to the presigned URL.
 * 
 * Request body: { metadata: { uniqueFilename, sanitizedFilename, shortCode, fileSize, mimeType, userId } }
 */
export async function POST(request: NextRequest) {
    try {
        // Verify admin authentication
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { metadata } = body;

        if (!metadata) {
            return NextResponse.json(
                { error: 'Missing metadata' },
                { status: 400 }
            );
        }

        const {
            uniqueFilename,
            sanitizedFilename,
            shortCode,
            fileSize,
            mimeType,
            userId,
        } = metadata;

        // Verify the user confirming is the same user who requested the presign
        if (userId !== user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
            return NextResponse.json(
                { error: 'File not found in storage. Upload may have failed.' },
                { status: 400 }
            );
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
            } as any)
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            // Clean up uploaded file since we couldn't save metadata
            await adminClient.storage.from('files').remove([uniqueFilename]);
            return NextResponse.json(
                { error: 'Failed to save file metadata' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            file: {
                id: (fileData as any).id,
                filename: (fileData as any).filename,
                originalFilename: (fileData as any).original_filename,
                shortCode: (fileData as any).short_code,
                shortUrl: `${env.app.url}/${(fileData as any).short_code}`,
            },
        });
    } catch (error) {
        console.error('Confirm error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
