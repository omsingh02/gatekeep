'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Field, IconButton, Input, StatusPill, type ControlSize } from '@/components/ds';
import { OWNER_PASSWORD_MIN, passwordStrength } from '@/lib/utils/passwordStrength';

export interface NewPasswordValues {
    password: string;
    confirm: string;
}

/** Inline errors for a new password + confirmation, or {} when they're fine. */
export function validateNewPassword(values: NewPasswordValues): { password?: string; confirm?: string } {
    const errors: { password?: string; confirm?: string } = {};
    if (values.password.length < OWNER_PASSWORD_MIN) errors.password = `Use at least ${OWNER_PASSWORD_MIN} characters.`;
    if (!values.confirm) errors.confirm = 'Enter the new password again.';
    else if (values.confirm !== values.password) errors.confirm = "The passwords don't match.";
    return errors;
}

export interface NewPasswordFieldsProps {
    values: NewPasswordValues;
    onChange: (values: NewPasswordValues) => void;
    errors?: { password?: string; confirm?: string };
    size?: ControlSize;
    label?: string;
}

/** New password (with a strength hint and show/hide) and its confirmation. */
export function NewPasswordFields({ values, onChange, errors = {}, size = 'md', label = 'New password' }: NewPasswordFieldsProps) {
    const [visible, setVisible] = useState(false);
    const strength = values.password ? passwordStrength(values.password) : null;
    const toggle = (
        <IconButton
            size="sm"
            label={visible ? 'Hide password' : 'Show password'}
            icon={visible ? <EyeOff aria-hidden strokeWidth={1.75} className="h-4 w-4" /> : <Eye aria-hidden strokeWidth={1.75} className="h-4 w-4" />}
            onClick={() => setVisible((v) => !v)}
        />
    );

    return (
        <>
            <Field
                label={label}
                error={errors.password}
                helper={strength ? strength.hint : `At least ${OWNER_PASSWORD_MIN} characters. A few unrelated words work well.`}
                labelAction={
                    strength && (
                        <StatusPill tone={strength.tone} className="-my-0.5">
                            {strength.label}
                        </StatusPill>
                    )
                }
            >
                <Input
                    size={size}
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={values.password}
                    onChange={(e) => onChange({ ...values, password: e.target.value })}
                    trailing={toggle}
                />
            </Field>
            <Field label={`Confirm ${label.toLowerCase()}`} error={errors.confirm}>
                <Input
                    size={size}
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={values.confirm}
                    onChange={(e) => onChange({ ...values, confirm: e.target.value })}
                />
            </Field>
        </>
    );
}
