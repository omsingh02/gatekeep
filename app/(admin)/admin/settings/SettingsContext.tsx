'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** GET/PATCH /api/settings → { settings } (lib/deliveries/settings.ts serializeSettings) */
export interface OwnerSettings {
    displayName: string | null;
    organization: string | null;
    logoUrl: string | null;
    recipientMessage: string | null;
    defaultMethod: 'email_code' | 'password';
    defaultEndsInDays: number | null;
    defaultDownloadLimit: number | null;
    notifyOpened: boolean;
    notifyDownloaded: boolean;
    notifyDenied: boolean;
    notifyUploaded: boolean;
    homepage: 'landing' | 'branded';
    ownerEmail: string | null;
    emailConfigured: boolean;
    senderPreview: string;
}

export type SettingsPatch = Partial<
    Pick<
        OwnerSettings,
        | 'displayName'
        | 'organization'
        | 'recipientMessage'
        | 'defaultMethod'
        | 'defaultEndsInDays'
        | 'defaultDownloadLimit'
        | 'notifyOpened'
        | 'notifyDownloaded'
        | 'notifyDenied'
        | 'notifyUploaded'
        | 'homepage'
    >
>;

export const DOCS_URL = 'https://github.com/omsingh02/gatekeep/blob/main/docs';
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a moment.';

/** Who recipients see as the sender (mirrors senderLabel in lib/deliveries/format.ts). */
export function senderPreview(displayName: string, organization: string, ownerEmail: string | null): string {
    const name = displayName.trim();
    const org = organization.trim();
    if (name && org) return `${name} from ${org}`;
    return name || org || ownerEmail || 'The sender';
}

export async function readError(res: Response): Promise<string> {
    const body = await res.json().catch(() => null);
    return (body && typeof body.error === 'string' && body.error) || GENERIC_ERROR;
}

interface SettingsContextValue {
    settings: OwnerSettings | null;
    loadError: string | null;
    reload: () => void;
    /** PATCH /api/settings; resolves with the saved settings or throws an Error with a readable message */
    save: (patch: SettingsPatch) => Promise<OwnerSettings>;
    /** Replace the local copy (after a logo upload, for example) */
    update: (patch: Partial<OwnerSettings>) => void;
    /** Sections report unsaved edits so navigation can ask before discarding them */
    setDirty: (section: string, dirty: boolean) => void;
    isDirty: () => boolean;
    clearDirty: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<OwnerSettings | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const dirty = useRef(new Set<string>());

    useEffect(() => {
        let cancelled = false;
        fetch('/api/settings', { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error(await readError(res));
                return (await res.json()).settings as OwnerSettings;
            })
            .then((data) => {
                if (cancelled) return;
                setSettings(data);
                setLoadError(null);
            })
            .catch((err: Error) => !cancelled && setLoadError(err.message || GENERIC_ERROR));
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    // Warn before closing the tab or reloading with unsaved edits
    useEffect(() => {
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (dirty.current.size === 0) return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

    const save = useCallback(async (patch: SettingsPatch) => {
        let res: Response;
        try {
            res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
        } catch {
            throw new Error("We couldn't reach Gatekeep. Check your connection and try again.");
        }
        if (!res.ok) throw new Error(await readError(res));
        const saved = (await res.json()).settings as OwnerSettings;
        setSettings(saved);
        return saved;
    }, []);

    const setDirty = useCallback((section: string, isDirty: boolean) => {
        if (isDirty) dirty.current.add(section);
        else dirty.current.delete(section);
    }, []);
    const isDirty = useCallback(() => dirty.current.size > 0, []);
    const clearDirty = useCallback(() => dirty.current.clear(), []);
    const reload = useCallback(() => setReloadToken((t) => t + 1), []);
    const update = useCallback(
        (patch: Partial<OwnerSettings>) => setSettings((current) => (current ? { ...current, ...patch } : current)),
        []
    );

    const value = useMemo<SettingsContextValue>(
        () => ({ settings, loadError, reload, save, update, setDirty, isDirty, clearDirty }),
        [settings, loadError, reload, save, update, setDirty, isDirty, clearDirty]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
    const value = useContext(SettingsContext);
    if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
    return value;
}

/** Report this section's unsaved state to the settings shell. */
export function useDirtySection(section: string, dirty: boolean) {
    const { setDirty } = useSettings();
    useEffect(() => {
        setDirty(section, dirty);
        return () => setDirty(section, false);
    }, [section, dirty, setDirty]);
}
