import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonError, requireOwner, serverError } from '@/lib/api/http';
import { getOwnerSettings, logoUrl } from '@/lib/deliveries/settings';

const ROUTE = '/api/settings/logo';
const MAX_BYTES = 2 * 1024 * 1024;

/** Identify the image by its first bytes, not by what the browser claims. */
function imageType(bytes: Uint8Array): { ext: string; mime: string } | null {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', mime: 'image/png' };
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
    return null;
}

/** POST multipart/form-data with a `file` field: PNG, JPEG or WebP, at most 2 MB. */
export async function POST(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'POST');
    if (user instanceof NextResponse) return user;
    try {
        const form = await request.formData().catch(() => null);
        const file = form?.get('file');
        if (!file || typeof file === 'string') return jsonError('Choose an image to upload.', 400, 'ERR_INVALID_INPUT');
        if (file.size > MAX_BYTES) return jsonError('Use an image of at most 2 MB.', 400, 'ERR_INVALID_FILE');

        const bytes = new Uint8Array(await file.arrayBuffer());
        const type = imageType(bytes);
        if (!type) return jsonError('Use a PNG, JPEG or WebP image.', 400, 'ERR_INVALID_FILE');

        const admin = createAdminClient();
        const previous = await getOwnerSettings(user.id);
        const path = `${user.id}/logo-${Date.now()}.${type.ext}`;
        const { error: uploadError } = await admin.storage
            .from('branding')
            .upload(path, bytes, { contentType: type.mime, cacheControl: '31536000', upsert: false });
        if (uploadError) throw uploadError;

        const { error } = await admin.from('owner_settings').upsert({ owner_id: user.id, logo_path: path }, { onConflict: 'owner_id' });
        if (error) throw error;
        if (previous.logo_path) await admin.storage.from('branding').remove([previous.logo_path]);

        return NextResponse.json({ logoUrl: logoUrl({ logo_path: path }) }, { status: 201 });
    } catch (err) {
        return serverError(ROUTE, user.id, 'POST', err);
    }
}

export async function DELETE() {
    const user = await requireOwner(ROUTE, 'DELETE');
    if (user instanceof NextResponse) return user;
    try {
        const admin = createAdminClient();
        const previous = await getOwnerSettings(user.id);
        if (previous.logo_path) {
            await admin.from('owner_settings').update({ logo_path: null }).eq('owner_id', user.id);
            await admin.storage.from('branding').remove([previous.logo_path]);
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        return serverError(ROUTE, user.id, 'DELETE', err);
    }
}
