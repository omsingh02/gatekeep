'use client';

import { useState, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge, Callout, Field, Input, Radio, Select, useToast } from '@/components/ds';
import { DOCS_URL, useDirtySection, useSettings, type OwnerSettings } from '../SettingsContext';
import { SettingsSection, WithSettings } from '../SettingsShell';

const END_PRESETS = [1, 7, 14, 30, 90];

interface Values {
    method: 'email_code' | 'password';
    ends: string; // '' = no end date, a preset number, or 'custom'
    customDays: string;
    limit: string;
}

function initialValues(settings: OwnerSettings): Values {
    const days = settings.defaultEndsInDays;
    return {
        method: settings.defaultMethod,
        ends: days == null ? '' : END_PRESETS.includes(days) ? String(days) : 'custom',
        customDays: days != null && !END_PRESETS.includes(days) ? String(days) : '',
        limit: settings.defaultDownloadLimit == null ? '' : String(settings.defaultDownloadLimit),
    };
}

function endsInDays(values: Values): number | null {
    if (!values.ends) return null;
    return Number(values.ends === 'custom' ? values.customDays : values.ends);
}

function SharingForm({ settings }: { settings: OwnerSettings }) {
    const { save } = useSettings();
    const toast = useToast();
    const [values, setValues] = useState<Values>(() => initialValues(settings));
    const [baseline, setBaseline] = useState<Values>(values);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<{ days?: string; limit?: string; method?: string }>({});

    const dirty =
        values.method !== baseline.method ||
        endsInDays(values) !== endsInDays(baseline) ||
        values.limit.trim() !== baseline.limit.trim() ||
        (values.ends === 'custom' && values.customDays !== baseline.customDays);
    useDirtySection('sharing', dirty);
    const set = (patch: Partial<Values>) => setValues((v) => ({ ...v, ...patch }));

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const next: typeof errors = {};
        const days = endsInDays(values);
        if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) next.days = 'Enter a number of days from 1 to 3650.';
        const limit = values.limit.trim() ? Number(values.limit) : null;
        if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 1000)) next.limit = 'Enter a whole number from 1 to 1000, or leave it empty.';
        setErrors(next);
        if (Object.keys(next).length) return;

        setSaving(true);
        try {
            const saved = await save({ defaultMethod: values.method, defaultEndsInDays: days, defaultDownloadLimit: limit });
            const clean = initialValues(saved);
            setValues(clean);
            setBaseline(clean);
            toast.success('Sharing defaults saved');
        } catch (err) {
            const message = err instanceof Error ? err.message : "We couldn't save your defaults. Try again.";
            if (/email/i.test(message)) setErrors({ method: message });
            else toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SettingsSection
            title="Sharing defaults"
            description="Pre-filled for each person you add to a new delivery. You can change them per person."
            onSubmit={onSubmit}
            saveLabel="Save defaults"
            saving={saving}
            dirty={dirty}
        >
            <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-1.5 flex w-full flex-wrap items-center justify-between gap-2">
                    <span className="text-caption font-medium text-secondary">Default access method</span>
                    <a
                        href={`${DOCS_URL}/ACCESS-METHODS.md`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-sm text-caption font-medium text-primary underline-offset-4 hover:text-strong hover:underline focus-ring"
                    >
                        Which should I use?
                        <ExternalLink aria-hidden strokeWidth={1.75} className="h-3 w-3" />
                    </a>
                </legend>
                <Radio
                    name="method"
                    value="email_code"
                    checked={values.method === 'email_code'}
                    disabled={!settings.emailConfigured}
                    onChange={() => set({ method: 'email_code' })}
                    label={
                        <span className="inline-flex flex-wrap items-center gap-2">
                            Email code <Badge>Recommended</Badge>
                        </span>
                    }
                    description={
                        settings.emailConfigured
                            ? 'Recipients get a 6-digit code at their email address. There are no passwords to send or lose.'
                            : "Needs email to be set up (RESEND_API_KEY and EMAIL_FROM). See System status."
                    }
                />
                <Radio
                    name="method"
                    value="password"
                    checked={values.method === 'password'}
                    onChange={() => set({ method: 'password' })}
                    label="Password"
                    description="Gatekeep makes a password for each person, and you send it to them separately."
                />
                {errors.method && (
                    <p role="alert" className="text-caption text-danger">
                        {errors.method}
                    </p>
                )}
                {!settings.emailConfigured && settings.defaultMethod === 'email_code' && (
                    <Callout tone="warning">This Gatekeep can&apos;t send email yet, so email codes won&apos;t arrive. Choose password until email is set up.</Callout>
                )}
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Access ends" helper={values.ends === 'custom' ? undefined : 'After this, people need a new invite.'} error={values.ends === 'custom' ? undefined : errors.days}>
                    <Select value={values.ends} onChange={(e) => set({ ends: e.target.value })}>
                        <option value="">No end date</option>
                        {END_PRESETS.map((d) => (
                            <option key={d} value={String(d)}>
                                {d === 1 ? 'After 1 day' : `After ${d} days`}
                            </option>
                        ))}
                        <option value="custom">Custom…</option>
                    </Select>
                </Field>
                {values.ends === 'custom' && (
                    <Field label="Days until access ends" helper="From 1 to 3650." error={errors.days}>
                        <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={3650}
                            value={values.customDays}
                            placeholder="60"
                            onChange={(e) => set({ customDays: e.target.value })}
                        />
                    </Field>
                )}
                <Field label="Download limit" helper="Optional. Downloads per person; leave empty for no limit." error={errors.limit}>
                <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    value={values.limit}
                    placeholder="No limit"
                    onChange={(e) => set({ limit: e.target.value })}
                />
                </Field>
            </div>
        </SettingsSection>
    );
}

export default function SharingSettings() {
    return <WithSettings rows={3}>{(settings) => <SharingForm settings={settings} />}</WithSettings>;
}
