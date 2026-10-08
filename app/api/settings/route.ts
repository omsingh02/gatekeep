import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailConfigured } from '@/lib/email/transport';
import { jsonError, readJson, requireOwner, serverError } from '@/lib/deliveries/http';
import { getOwnerSettings, parseSettingsPatch, serializeSettings } from '@/lib/deliveries/settings';

const ROUTE = '/api/settings';

export async function GET() {
    const user = await requireOwner(ROUTE, 'GET');
    if (user instanceof NextResponse) return user;
    try {
        const settings = await getOwnerSettings(user.id);
        return NextResponse.json({
            settings: serializeSettings(settings, { ownerEmail: user.email ?? null, emailConfigured: emailConfigured() }),
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'GET', err);
    }
}

/**
 * PATCH { displayName?, organization?, recipientMessage?, defaultMethod?, defaultEndsInDays?,
 *         defaultDownloadLimit?, notifyOpened?, notifyDownloaded?, notifyDenied?, notifyUploaded?, homepage? }
 */
export async function PATCH(request: NextRequest) {
    const user = await requireOwner(ROUTE, 'PATCH');
    if (user instanceof NextResponse) return user;
    try {
        const parsed = parseSettingsPatch(await readJson(request));
        if ('error' in parsed) return jsonError(parsed.error, 400, 'ERR_INVALID_INPUT');
        if (parsed.update.default_method === 'email_code' && !emailConfigured()) {
            return jsonError(
                "Email codes need email to be set up. Set RESEND_API_KEY and EMAIL_FROM first, or keep passwords as the default.",
                400,
                'ERR_EMAIL_NOT_CONFIGURED',
            );
        }

        const { error } = await createAdminClient()
            .from('owner_settings')
            .upsert({ owner_id: user.id, ...parsed.update }, { onConflict: 'owner_id' });
        if (error) throw error;

        const settings = await getOwnerSettings(user.id);
        return NextResponse.json({
            settings: serializeSettings(settings, { ownerEmail: user.email ?? null, emailConfigured: emailConfigured() }),
        });
    } catch (err) {
        return serverError(ROUTE, user.id, 'PATCH', err);
    }
}
