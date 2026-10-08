'use client';

import { useState, type FormEvent } from 'react';
import { Avatar, Callout, Field, Input, useToast } from '@/components/ds';
import { senderPreview, useDirtySection, useSettings, type OwnerSettings } from '../SettingsContext';
import { SettingsSection, WithSettings } from '../SettingsShell';

const MAX = 80;

function ProfileForm({ settings }: { settings: OwnerSettings }) {
    const { save } = useSettings();
    const toast = useToast();
    const [values, setValues] = useState({ displayName: settings.displayName ?? '', organization: settings.organization ?? '' });
    const [baseline, setBaseline] = useState(values);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<{ displayName?: string; organization?: string }>({});

    const dirty = values.displayName !== baseline.displayName || values.organization !== baseline.organization;
    useDirtySection('profile', dirty);
    const preview = senderPreview(values.displayName, values.organization, settings.ownerEmail);

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const next: typeof errors = {};
        if (values.displayName.trim().length > MAX) next.displayName = `Use at most ${MAX} characters.`;
        if (values.organization.trim().length > MAX) next.organization = `Use at most ${MAX} characters.`;
        setErrors(next);
        if (Object.keys(next).length) return;

        setSaving(true);
        try {
            const saved = await save({ displayName: values.displayName, organization: values.organization });
            const clean = { displayName: saved.displayName ?? '', organization: saved.organization ?? '' };
            setValues(clean);
            setBaseline(clean);
            toast.success('Profile saved');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "We couldn't save your profile. Try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection
            title="Profile"
            description="Recipients see your name on delivery pages and in every email Gatekeep sends for you."
            onSubmit={onSubmit}
            saveLabel="Save profile"
            saving={saving}
            dirty={dirty}
        >
            <Field label="Your name" helper="Your full name, as recipients know you." error={errors.displayName}>
                <Input
                    value={values.displayName}
                    maxLength={MAX}
                    autoComplete="name"
                    placeholder="Maya Chen"
                    onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))}
                />
            </Field>
            <Field label="Organization" helper="Optional" error={errors.organization}>
                <Input
                    value={values.organization}
                    maxLength={MAX}
                    autoComplete="organization"
                    placeholder="Northwind"
                    onChange={(e) => setValues((v) => ({ ...v, organization: e.target.value }))}
                />
            </Field>
            <Callout tone="neutral" title="How recipients see you">
                <span className="mt-1.5 flex items-start gap-2.5">
                    <Avatar name={preview} size="sm" />
                    <span className="min-w-0">
                        <span className="font-medium text-strong" data-testid="sender-preview">
                            {preview}
                        </span>{' '}
                        sent you files
                    </span>
                </span>
                {!values.displayName.trim() && !values.organization.trim() && (
                    <span className="mt-1.5 block text-caption text-tertiary">
                        Without a name, recipients see your email address.
                    </span>
                )}
            </Callout>
        </SettingsSection>
    );
}

export default function ProfileSettings() {
    return <WithSettings>{(settings) => <ProfileForm settings={settings} />}</WithSettings>;
}
