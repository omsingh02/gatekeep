'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Callout, Switch, useToast } from '@/components/ds';
import { useSettings, type OwnerSettings } from '../SettingsContext';
import { SettingsSection, WithSettings } from '../SettingsShell';

type NotifyKey = 'notifyOpened' | 'notifyDownloaded' | 'notifyDenied' | 'notifyUploaded';

const OPTIONS: { key: NotifyKey; label: string; description: string; on: string; off: string }[] = [
    {
        key: 'notifyOpened',
        label: 'Someone opens a delivery',
        description: 'The first time each person opens it each day.',
        on: "We'll email you when someone opens a delivery",
        off: "We won't email you about opens",
    },
    {
        key: 'notifyDownloaded',
        label: 'Someone downloads a file',
        description: 'Every download, including Download all.',
        on: "We'll email you about every download",
        off: "We won't email you about downloads",
    },
    {
        key: 'notifyDenied',
        label: 'Someone is denied',
        description: 'One email when 3 attempts on a delivery are denied within 15 minutes.',
        on: "We'll email you when people are denied",
        off: "We won't email you about denied attempts",
    },
    {
        key: 'notifyUploaded',
        label: 'Files are uploaded to a request',
        description: 'One email for each batch of uploads.',
        on: "We'll email you when files arrive on a request",
        off: "We won't email you about uploads",
    },
];

function NotificationForm({ settings }: { settings: OwnerSettings }) {
    const { save, update } = useSettings();
    const toast = useToast();
    const [saving, setSaving] = useState<NotifyKey | null>(null);
    const disabled = !settings.emailConfigured;

    const toggle = async (key: NotifyKey, value: boolean) => {
        const option = OPTIONS.find((o) => o.key === key)!;
        update({ [key]: value });
        setSaving(key);
        try {
            await save({ [key]: value });
            toast.success(value ? option.on : option.off);
        } catch (err) {
            update({ [key]: !value });
            toast.error(err instanceof Error ? err.message : "We couldn't change that notification. Try again.");
        } finally {
            setSaving(null);
        }
    };

    return (
        <SettingsSection
            title="Email notifications"
            description={
                settings.ownerEmail ? (
                    <>
                        Sent to <span className="font-medium text-primary">{settings.ownerEmail}</span>, the email you sign in with. Changes apply right away.
                    </>
                ) : (
                    'Sent to the email you sign in with. Changes apply right away.'
                )
            }
        >
            {disabled && (
                <Callout
                    tone="warning"
                    title="Email isn't set up"
                    action={
                        <Link href="/admin/settings/status" className="rounded-sm text-body-sm font-medium text-strong underline-offset-4 hover:underline focus-ring">
                            System status
                        </Link>
                    }
                >
                    Gatekeep can&apos;t send notifications until RESEND_API_KEY and EMAIL_FROM are set. Everything is still recorded in Activity.
                </Callout>
            )}
            <div className="flex flex-col gap-1">
                <p className="text-caption font-medium text-secondary">Email me when…</p>
                <ul className="flex flex-col divide-y divide-gray-4">
                    {OPTIONS.map((option) => (
                        <li key={option.key} className="py-3 first:pt-2 last:pb-0">
                            <Switch
                                checked={settings[option.key]}
                                disabled={disabled || saving === option.key}
                                onCheckedChange={(value) => toggle(option.key, value)}
                                label={option.label}
                                description={option.description}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        </SettingsSection>
    );
}

export default function NotificationSettings() {
    return <WithSettings rows={4}>{(settings) => <NotificationForm settings={settings} />}</WithSettings>;
}
