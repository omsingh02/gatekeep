'use client';

import { useEffect, useState } from 'react';
import { api, fetchEmailConfigured, type AccessMethod, type OwnerSettingsView } from './api';

export interface OwnerDefaults {
    loaded: boolean;
    /** From GET /api/status; undefined until it loads */
    emailConfigured: boolean | undefined;
    defaultMethod: AccessMethod;
    defaultEndsInDays: number | null;
    defaultDownloadLimit: number | null;
}

/** Sharing defaults (Settings) and whether email works (System status), for the compose screens. */
export function useOwnerDefaults(): OwnerDefaults {
    const [state, setState] = useState<OwnerDefaults>({
        loaded: false,
        emailConfigured: undefined,
        defaultMethod: 'email_code',
        defaultEndsInDays: null,
        defaultDownloadLimit: null,
    });

    useEffect(() => {
        let cancelled = false;
        Promise.allSettled([fetchEmailConfigured(), api<{ settings: OwnerSettingsView }>('/api/settings')]).then(([status, settings]) => {
            if (cancelled) return;
            const s = settings.status === 'fulfilled' ? settings.value.settings : null;
            const emailConfigured = status.status === 'fulfilled' ? status.value : (s?.emailConfigured ?? undefined);
            setState({
                loaded: true,
                emailConfigured,
                defaultMethod: emailConfigured === false ? 'password' : (s?.defaultMethod ?? 'email_code'),
                defaultEndsInDays: s?.defaultEndsInDays ?? null,
                defaultDownloadLimit: s?.defaultDownloadLimit ?? null,
            });
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}

/** Whether email works, for screens that only need that. */
export function useEmailConfigured(): boolean | undefined {
    const [value, setValue] = useState<boolean | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        fetchEmailConfigured()
            .then((v) => !cancelled && setValue(v))
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);
    return value;
}
