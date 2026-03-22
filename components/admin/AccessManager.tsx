'use client';

import { useState, useEffect } from 'react';
import { Modal, ConfirmDialog, useToast, ExpiryPicker, EmptyState } from '@/components/ui';
import { FileMetadata, FileAccess } from '@/lib/types';
import { generateRandomPassword } from '@/lib/utils/crypto';
import { formatDateTime } from '@/lib/utils/date';

interface AccessManagerProps {
    file: FileMetadata;
    isOpen: boolean;
    onClose: () => void;
}

export default function AccessManager({ file, isOpen, onClose }: AccessManagerProps) {
    const [accessList, setAccessList] = useState<FileAccess[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [userIdentifier, setUserIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [maxDownloads, setMaxDownloads] = useState('');
    const [error, setError] = useState('');
    
    // Identifier type state (email or username)
    const [identifierType, setIdentifierType] = useState<'email' | 'username'>('username');
    const [notifyOnGrant, setNotifyOnGrant] = useState(false);
    
    // Bulk mode state
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkIdentifiers, setBulkIdentifiers] = useState('');
    const [bulkResults, setBulkResults] = useState<{ success: string[]; failed: Array<{ identifier: string; error: string }> } | null>(null);
    const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
    
    // Edit mode state
    const [editingAccess, setEditingAccess] = useState<FileAccess | null>(null);
    const [editPassword, setEditPassword] = useState('');
    const [editExpiresAt, setEditExpiresAt] = useState('');
    const [editMaxDownloads, setEditMaxDownloads] = useState('');
    const [editResetDownloads, setEditResetDownloads] = useState(false);
    const [editError, setEditError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [duplicateUserIdentifier, setDuplicateUserIdentifier] = useState<string | null>(null);

    // Grant mode state (user or public)
    const [grantMode, setGrantMode] = useState<'user' | 'public'>('user');

    // Dialog state
    const [revokeConfirm, setRevokeConfirm] = useState<{ isOpen: boolean; accessId: string | null; name: string }>({
        isOpen: false,
        accessId: null,
        name: '',
    });
    const toast = useToast();

    useEffect(() => {
        if (isOpen) {
            fetchAccessList();
            setGrantMode('user');
            setIsBulkMode(false);
            setBulkIdentifiers('');
            setBulkResults(null);
            setBulkProgress(null);
        }
    }, [isOpen, file.id]);

    const fetchAccessList = async () => {
        try {
            const response = await fetch(`/api/access?fileId=${file.id}`);
            if (response.ok) {
                const data = await response.json();
                setAccessList(data.access || []);
            }
        } catch (error) {
            // Error handled silently
        }
    };

    const handleAddAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Convert datetime-local to ISO string with timezone
            const expiresAtISO = expiresAt ? new Date(expiresAt).toISOString() : null;

            const payload: any = {
                fileId: file.id,
                password,
                expiresAt: expiresAtISO,
                maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
            };

            if (grantMode === 'public') {
                payload.isPublic = true;
            } else {
                payload.userIdentifier = userIdentifier;
                payload.identifierType = identifierType;
                payload.notifyOnGrant = notifyOnGrant;
            }
            const response = await fetch('/api/access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                // Check if it's a duplicate error (409 Conflict)
                if (response.status === 409 && grantMode === 'user') {
                    setDuplicateUserIdentifier(userIdentifier);
                    setError(data.error || 'User already has access');
                } else {
                    setDuplicateUserIdentifier(null);
                    throw new Error(data.error || 'Failed to add access');
                }
                return;
            }

            const responseData = await response.json();
            setDuplicateUserIdentifier(null);

            // Show success toast with email status
            if (responseData.emailSent) {
                toast.success('Access granted and email notification sent');
            } else if (notifyOnGrant && identifierType === 'email') {
                toast.warning('Access granted but email notification failed');
            } else {
                toast.success('Access granted successfully');
            }

            // Reset form
            setUserIdentifier('');
            setPassword('');
            setExpiresAt('');
            setMaxDownloads('');
            setNotifyOnGrant(false);

            // Refresh list
            await fetchAccessList();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkAddAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setBulkResults(null);
        setIsLoading(true);

        // Parse identifiers (split by newlines, commas, or semicolons)
        const identifiers = bulkIdentifiers
            .split(/[\n,;]+/)
            .map(id => id.trim())
            .filter(id => id.length > 0);

        if (identifiers.length === 0) {
            setError('Please enter at least one identifier');
            setIsLoading(false);
            return;
        }

        // Remove duplicates
        const uniqueIdentifiers = [...new Set(identifiers.map(id => id.toLowerCase()))];
        
        const results: { success: string[]; failed: Array<{ identifier: string; error: string }> } = {
            success: [],
            failed: [],
        };

        setBulkProgress({ current: 0, total: uniqueIdentifiers.length });

        try {
            const expiresAtISO = expiresAt ? new Date(expiresAt).toISOString() : null;

            for (let i = 0; i < uniqueIdentifiers.length; i++) {
                const identifier = uniqueIdentifiers[i];
                setBulkProgress({ current: i + 1, total: uniqueIdentifiers.length });

                try {
                    const payload: any = {
                        fileId: file.id,
                        password,
                        expiresAt: expiresAtISO,
                        maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
                        userIdentifier: identifier,
                        identifierType,
                        notifyOnGrant,
                    };

                    const response = await fetch('/api/access', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    if (response.ok) {
                        results.success.push(identifier);
                    } else {
                        const data = await response.json();
                        results.failed.push({ identifier, error: data.error || 'Failed to grant access' });
                    }
                } catch (err: any) {
                    results.failed.push({ identifier, error: err.message || 'Network error' });
                }
            }

            setBulkResults(results);

            // Show summary toast
            if (results.failed.length === 0) {
                toast.success(`Successfully granted access to ${results.success.length} users`);
            } else if (results.success.length === 0) {
                toast.error(`Failed to grant access to all ${results.failed.length} users`);
            } else {
                toast.warning(`Granted ${results.success.length} of ${uniqueIdentifiers.length} (${results.failed.length} failed)`);
            }

            // Reset form on complete success
            if (results.failed.length === 0) {
                setBulkIdentifiers('');
                setPassword('');
                setExpiresAt('');
                setMaxDownloads('');
                setNotifyOnGrant(false);
            }

            // Refresh list
            await fetchAccessList();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
            setBulkProgress(null);
        }
    };

    const handleRevokeAccess = async (accessId: string) => {
        try {
            const response = await fetch(`/api/access?id=${accessId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setAccessList(accessList.filter(a => a.id !== accessId));
                toast.success('Access revoked successfully');
            } else {
                toast.error('Failed to revoke access');
            }
        } catch (error) {
            toast.error('Failed to revoke access');
        } finally {
            setRevokeConfirm({ isOpen: false, accessId: null, name: '' });
        }
    };

    const confirmRevoke = (access: FileAccess) => {
        const name = access.type === 'public'
            ? 'Public Access'
            : access.userIdentifier || 'User access';
        setRevokeConfirm({ isOpen: true, accessId: access.id, name });
    };

    const handleGeneratePassword = () => {
        setPassword(generateRandomPassword(12));
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    const handleEditAccess = (access: FileAccess) => {
        setEditingAccess(access);
        setEditPassword(''); // Don't pre-fill password for security
        setEditExpiresAt(access.expiresAt ? new Date(access.expiresAt).toISOString().slice(0, 16) : '');
        setEditMaxDownloads(access.maxDownloads?.toString() || '');
        setEditResetDownloads(false);
        setEditError('');
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccess) return;
        
        setEditError('');
        setIsEditing(true);

        try {
            const response = await fetch('/api/access', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accessId: editingAccess.id,
                    password: editPassword || undefined, // Only send if changed
                    expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
                    maxDownloads: editMaxDownloads ? parseInt(editMaxDownloads) : null,
                    resetDownloads: editResetDownloads,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update access');
            }

            toast.success('Access updated successfully');
            setEditingAccess(null);
            await fetchAccessList();
        } catch (err: any) {
            setEditError(err.message);
        } finally {
            setIsEditing(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingAccess(null);
        setEditPassword('');
        setEditExpiresAt('');
        setEditMaxDownloads('');
        setEditResetDownloads(false);
        setEditError('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage File Access" size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* File Info */}
                <div style={{
                    padding: '1rem',
                    borderRadius: '6px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #3a3a3a',
                }}>
                    <h3 style={{
                        fontWeight: 500,
                        color: '#e0e0e0',
                        marginBottom: '0.25rem',
                        fontSize: '0.95rem',
                    }}>{file.originalFilename}</h3>
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0 }}>
                        Short link: <code style={{
                            padding: '0.125rem 0.5rem',
                            borderRadius: '3px',
                            backgroundColor: '#252525',
                            color: '#3b82f6',
                            fontSize: '0.8rem',
                        }}>
                            {window.location.origin}/{file.shortCode}
                        </code>
                    </p>
                </div>

                {/* Add Access Form */}
                <form onSubmit={isBulkMode ? handleBulkAddAccess : handleAddAccess} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #3a3a3a',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{
                            fontWeight: 500,
                            color: '#e0e0e0',
                            margin: 0,
                            fontSize: '0.95rem',
                        }}>Grant New Access</h4>
                        
                        {grantMode === 'user' && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsBulkMode(!isBulkMode);
                                    setBulkResults(null);
                                    setError('');
                                }}
                                style={{
                                    padding: '0.35rem 0.6rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: isBulkMode ? '#fbbf24' : '#9ca3af',
                                    backgroundColor: isBulkMode ? '#78350f' : 'transparent',
                                    border: `1px solid ${isBulkMode ? '#f59e0b' : '#3a3a3a'}`,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {isBulkMode ? '← Single User' : 'Bulk Grant →'}
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setGrantMode('user');
                                setError('');
                                setDuplicateUserIdentifier(null);
                            }}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                color: grantMode === 'user' ? '#ffffff' : '#9ca3af',
                                backgroundColor: grantMode === 'user' ? '#2563eb' : 'transparent',
                                border: `1px solid ${grantMode === 'user' ? '#3b82f6' : '#3a3a3a'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            User Access
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setGrantMode('public');
                                setIsBulkMode(false);
                                setBulkResults(null);
                                setError('');
                                setDuplicateUserIdentifier(null);
                            }}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                color: grantMode === 'public' ? '#ffffff' : '#9ca3af',
                                backgroundColor: grantMode === 'public' ? '#059669' : 'transparent',
                                border: `1px solid ${grantMode === 'public' ? '#10b981' : '#3a3a3a'}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            Public Link
                        </button>
                    </div>

                    {grantMode === 'public' && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            backgroundColor: '#064e3b',
                            border: '1px solid #10b981',
                        }}>
                            <p style={{ fontSize: '0.875rem', color: '#a7f3d0', margin: 0 }}>
                                Public link allows anyone with the password to access the file. No username or email required.
                            </p>
                        </div>
                    )}

                    {grantMode === 'user' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {/* Email/Username Toggle */}
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    marginBottom: '0.5rem',
                                }}>Identifier Type</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIdentifierType('username');
                                            setNotifyOnGrant(false);
                                        }}
                                        style={{
                                            padding: '0.4rem 0.75rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            color: identifierType === 'username' ? '#ffffff' : '#9ca3af',
                                            backgroundColor: identifierType === 'username' ? '#374151' : 'transparent',
                                            border: `1px solid ${identifierType === 'username' ? '#4b5563' : '#3a3a3a'}`,
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        Username
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIdentifierType('email')}
                                        style={{
                                            padding: '0.4rem 0.75rem',
                                            fontSize: '0.8rem',
                                            fontWeight: 500,
                                            color: identifierType === 'email' ? '#ffffff' : '#9ca3af',
                                            backgroundColor: identifierType === 'email' ? '#374151' : 'transparent',
                                            border: `1px solid ${identifierType === 'email' ? '#4b5563' : '#3a3a3a'}`,
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        Email
                                    </button>
                                </div>
                            </div>

                            {/* Bulk mode info banner */}
                            {isBulkMode && (
                                <div style={{
                                    padding: '0.75rem',
                                    borderRadius: '4px',
                                    backgroundColor: '#78350f',
                                    border: '1px solid #f59e0b',
                                }}>
                                    <p style={{ fontSize: '0.875rem', color: '#fef3c7', margin: 0 }}>
                                        Enter multiple {identifierType === 'email' ? 'email addresses' : 'usernames'} — one per line, or separated by commas.
                                        All users will receive the same password and settings.
                                    </p>
                                </div>
                            )}

                            {/* Single user input or bulk textarea */}
                            {isBulkMode ? (
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        color: '#9ca3af',
                                        marginBottom: '0.5rem',
                                    }}>{identifierType === 'email' ? 'Email Addresses' : 'Usernames'}</label>
                                    <textarea
                                        value={bulkIdentifiers}
                                        onChange={(e) => setBulkIdentifiers(e.target.value)}
                                        placeholder={identifierType === 'email' 
                                            ? 'user1@example.com\nuser2@example.com\nuser3@example.com' 
                                            : 'john_doe\njane_smith\nbob_wilson'}
                                        required
                                        rows={5}
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.875rem',
                                            borderRadius: '4px',
                                            border: '1px solid #3a3a3a',
                                            backgroundColor: '#1a1a1a',
                                            color: '#e0e0e0',
                                            fontSize: '0.875rem',
                                            outline: 'none',
                                            resize: 'vertical',
                                            fontFamily: 'monospace',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#3b82f6';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#3a3a3a';
                                        }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                        {bulkIdentifiers.split(/[\n,;]+/).filter(id => id.trim()).length} identifier(s) entered
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        color: '#9ca3af',
                                        marginBottom: '0.5rem',
                                    }}>{identifierType === 'email' ? 'Email Address' : 'Username'}</label>
                                    <input
                                        type={identifierType === 'email' ? 'email' : 'text'}
                                        value={userIdentifier}
                                        onChange={(e) => setUserIdentifier(e.target.value)}
                                        placeholder={identifierType === 'email' ? 'user@example.com' : 'Enter username'}
                                        required={grantMode === 'user'}
                                        style={{
                                            width: '100%',
                                            padding: '0.625rem 0.875rem',
                                            borderRadius: '4px',
                                            border: '1px solid #3a3a3a',
                                            backgroundColor: '#1a1a1a',
                                            color: '#e0e0e0',
                                            fontSize: '0.875rem',
                                            outline: 'none',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#3b82f6';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#3a3a3a';
                                        }}
                                    />
                                </div>
                            )}

                            {/* Email notification option */}
                            {identifierType === 'email' && (
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    borderRadius: '4px',
                                    backgroundColor: notifyOnGrant ? '#1e3a5f' : 'transparent',
                                    border: `1px solid ${notifyOnGrant ? '#3b82f6' : '#3a3a3a'}`,
                                    transition: 'all 0.2s',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={notifyOnGrant}
                                        onChange={(e) => setNotifyOnGrant(e.target.checked)}
                                        style={{ 
                                            width: '16px', 
                                            height: '16px',
                                            accentColor: '#3b82f6',
                                        }}
                                    />
                                    <span>Send email notification with access details</span>
                                </label>
                            )}
                        </div>
                    )}

                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            color: '#9ca3af',
                            marginBottom: '0.5rem',
                        }}>Password</label>
                        <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.875rem',
                                borderRadius: '4px',
                                border: '1px solid #3a3a3a',
                                backgroundColor: '#1a1a1a',
                                color: '#e0e0e0',
                                fontSize: '0.875rem',
                                outline: 'none',
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#3a3a3a';
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleGeneratePassword}
                            style={{
                                marginTop: '0.5rem',
                                padding: '0.375rem 0.75rem',
                                fontSize: '0.8rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#e0e0e0'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                        >
                            Generate Random Password
                        </button>
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.875rem',
                            color: '#9ca3af',
                            marginBottom: '0.5rem',
                        }}>Max Downloads (Optional)</label>
                        <input
                            type="number"
                            min="1"
                            value={maxDownloads}
                            onChange={(e) => setMaxDownloads(e.target.value)}
                            placeholder="Unlimited"
                            style={{
                                width: '100%',
                                padding: '0.625rem 0.875rem',
                                borderRadius: '4px',
                                border: '1px solid #3a3a3a',
                                backgroundColor: '#1a1a1a',
                                color: '#e0e0e0',
                                fontSize: '0.875rem',
                                outline: 'none',
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#3a3a3a';
                            }}
                        />
                    </div>

                    <ExpiryPicker
                        value={expiresAt}
                        onChange={setExpiresAt}
                        label="Expiry (Optional)"
                    />

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            backgroundColor: duplicateUserIdentifier ? '#1e3a5f' : '#7f1d1d',
                            border: `1px solid ${duplicateUserIdentifier ? '#3b82f6' : '#ef4444'}`,
                        }}>
                            <p style={{ fontSize: '0.875rem', color: duplicateUserIdentifier ? '#93c5fd' : '#fecaca', margin: 0 }}>
                                {error}
                            </p>
                            {duplicateUserIdentifier && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const existingGrant = accessList.find(
                                            a => a.type === 'user' && a.userIdentifier && a.userIdentifier.toLowerCase() === duplicateUserIdentifier.toLowerCase()
                                        );
                                        if (existingGrant) {
                                            handleEditAccess(existingGrant);
                                            setError('');
                                            setDuplicateUserIdentifier(null);
                                            setUserIdentifier('');
                                            setPassword('');
                                        }
                                    }}
                                    style={{
                                        marginTop: '0.5rem',
                                        padding: '0.375rem 0.75rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 500,
                                        color: 'white',
                                        backgroundColor: '#3b82f6',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Edit Existing Grant →
                                </button>
                            )}
                        </div>
                    )}

                    {/* Bulk Progress Indicator */}
                    {bulkProgress && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            backgroundColor: '#1e3a5f',
                            border: '1px solid #3b82f6',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.875rem', color: '#93c5fd' }}>
                                    Processing {bulkProgress.current} of {bulkProgress.total}...
                                </span>
                                <span style={{ fontSize: '0.875rem', color: '#93c5fd' }}>
                                    {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                                </span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '6px',
                                backgroundColor: '#1a1a1a',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                                    height: '100%',
                                    backgroundColor: '#3b82f6',
                                    transition: 'width 0.2s',
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Bulk Results Summary */}
                    {bulkResults && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '4px',
                            backgroundColor: bulkResults.failed.length === 0 ? '#064e3b' : bulkResults.success.length === 0 ? '#7f1d1d' : '#78350f',
                            border: `1px solid ${bulkResults.failed.length === 0 ? '#10b981' : bulkResults.success.length === 0 ? '#ef4444' : '#f59e0b'}`,
                        }}>
                            <p style={{ 
                                fontSize: '0.875rem', 
                                color: bulkResults.failed.length === 0 ? '#a7f3d0' : bulkResults.success.length === 0 ? '#fecaca' : '#fef3c7', 
                                margin: 0,
                                fontWeight: 500,
                            }}>
                                {bulkResults.failed.length === 0 
                                    ? `✓ Successfully granted access to ${bulkResults.success.length} users`
                                    : bulkResults.success.length === 0 
                                        ? `✗ Failed to grant access to all ${bulkResults.failed.length} users`
                                        : `⚠ Granted ${bulkResults.success.length} of ${bulkResults.success.length + bulkResults.failed.length}`}
                            </p>
                            {bulkResults.failed.length > 0 && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <p style={{ fontSize: '0.75rem', color: '#fef3c7', margin: '0 0 0.25rem 0' }}>Failed:</p>
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.75rem', color: '#fecaca' }}>
                                        {bulkResults.failed.slice(0, 5).map((f, i) => (
                                            <li key={i}>{f.identifier}: {f.error}</li>
                                        ))}
                                        {bulkResults.failed.length > 5 && (
                                            <li>...and {bulkResults.failed.length - 5} more</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setBulkResults(null)}
                                style={{
                                    marginTop: '0.5rem',
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    color: '#9ca3af',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'white',
                            backgroundColor: isBulkMode ? '#d97706' : '#3b82f6',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.6 : 1,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = isBulkMode ? '#b45309' : '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                            if (!isLoading) e.currentTarget.style.backgroundColor = isBulkMode ? '#d97706' : '#3b82f6';
                        }}
                    >
                        {isLoading 
                            ? (isBulkMode ? 'Granting Access...' : 'Granting Access...') 
                            : (isBulkMode ? 'Grant Access to All' : 'Grant Access')}
                    </button>
                </form>

                {/* Access List */}
                <div>
                    <h4 style={{
                        fontWeight: 500,
                        color: '#e0e0e0',
                        marginBottom: '0.75rem',
                        fontSize: '0.95rem',
                    }}>Current Access Grants</h4>

                    {accessList.length === 0 ? (
                        <EmptyState
                            type="no-access"
                            title="No access grants yet"
                            description="Grant access above to let users view this file"
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {accessList.map((access) => (
                                <div
                                    key={access.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem',
                                        borderRadius: '4px',
                                        border: '1px solid #3a3a3a',
                                        backgroundColor: '#252525',
                                        flexWrap: 'wrap',
                                        gap: '0.75rem',
                                    }}
                                >
                                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <p style={{
                                                fontWeight: 500,
                                                color: '#e0e0e0',
                                                margin: 0,
                                                fontSize: '0.875rem',
                                            }}>
                                                {access.type === 'public'
                                                    ? 'Public Access'
                                                    : access.userIdentifier || 'User access'}
                                            </p>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.15rem 0.4rem',
                                                borderRadius: '3px',
                                                backgroundColor: access.type === 'public' ? '#064e3b' : '#1f2937',
                                                color: access.type === 'public' ? '#a7f3d0' : '#d1d5db',
                                                border: `1px solid ${access.type === 'public' ? '#10b981' : '#3a3a3a'}`,
                                            }}>
                                                {access.type === 'public' ? 'Public' : 'User'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                Accessed {access.accessCount} times
                                            </span>
                                            {access.maxDownloads && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '3px',
                                                    backgroundColor: (access.downloadCount || 0) >= access.maxDownloads ? '#7f1d1d' : '#1e3a8a',
                                                    color: (access.downloadCount || 0) >= access.maxDownloads ? '#fecaca' : '#93c5fd',
                                                }}>
                                                    {access.downloadCount || 0}/{access.maxDownloads} downloads
                                                </span>
                                            )}
                                            {access.expiresAt && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '3px',
                                                    backgroundColor: isExpired(access.expiresAt) ? '#7f1d1d' : '#78350f',
                                                    color: isExpired(access.expiresAt) ? '#fecaca' : '#fcd34d',
                                                }}>
                                                    {isExpired(access.expiresAt) 
                                                        ? 'Expired' 
                                                        : `Expires ${formatDateTime(access.expiresAt)}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => handleEditAccess(access)}
                                            style={{
                                                padding: '0.375rem 0.75rem',
                                                fontSize: '0.8rem',
                                                color: '#3b82f6',
                                                backgroundColor: 'transparent',
                                                border: '1px solid #3a3a3a',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontWeight: 500,
                                                flex: '1 1 auto',
                                                minWidth: '60px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#1e3a8a';
                                                e.currentTarget.style.borderColor = '#3b82f6';
                                                e.currentTarget.style.color = '#ffffff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.borderColor = '#3a3a3a';
                                                e.currentTarget.style.color = '#3b82f6';
                                            }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => confirmRevoke(access)}
                                            style={{
                                                padding: '0.375rem 0.75rem',
                                                fontSize: '0.8rem',
                                                color: '#ef4444',
                                                backgroundColor: 'transparent',
                                                border: '1px solid #3a3a3a',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontWeight: 500,
                                                flex: '1 1 auto',
                                                minWidth: '65px',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#7f1d1d';
                                                e.currentTarget.style.borderColor = '#ef4444';
                                                e.currentTarget.style.color = '#ffffff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.borderColor = '#3a3a3a';
                                                e.currentTarget.style.color = '#ef4444';
                                            }}
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Edit Access Modal */}
                {editingAccess && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}>
                        <form 
                            onSubmit={handleSaveEdit}
                            style={{
                                backgroundColor: '#2a2a2a',
                                borderRadius: '8px',
                                border: '1px solid #3a3a3a',
                                padding: '1.5rem',
                                width: '100%',
                                maxWidth: '400px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                            }}
                        >
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: '#e0e0e0',
                                margin: 0,
                            }}>
                                Edit Access: {editingAccess.type === 'public' ? 'Public Access' : (editingAccess.userIdentifier || 'User access')}
                            </h3>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    marginBottom: '0.5rem',
                                }}>New Password (leave empty to keep current)</label>
                                <input
                                    type="text"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem 0.875rem',
                                        borderRadius: '4px',
                                        border: '1px solid #3a3a3a',
                                        backgroundColor: '#1a1a1a',
                                        color: '#e0e0e0',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    marginBottom: '0.5rem',
                                }}>Max Downloads</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={editMaxDownloads}
                                    onChange={(e) => setEditMaxDownloads(e.target.value)}
                                    placeholder="Unlimited"
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem 0.875rem',
                                        borderRadius: '4px',
                                        border: '1px solid #3a3a3a',
                                        backgroundColor: '#1a1a1a',
                                        color: '#e0e0e0',
                                        fontSize: '0.875rem',
                                        outline: 'none',
                                    }}
                                />
                                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                    Current: {editingAccess.downloadCount || 0} downloads used
                                    {editingAccess.maxDownloads && ` of ${editingAccess.maxDownloads}`}
                                </p>
                            </div>

                            <div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.875rem',
                                    color: '#9ca3af',
                                    cursor: 'pointer',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={editResetDownloads}
                                        onChange={(e) => setEditResetDownloads(e.target.checked)}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    Reset download counter to 0
                                </label>
                            </div>

                            <ExpiryPicker
                                value={editExpiresAt}
                                onChange={setEditExpiresAt}
                                label="Expiry"
                            />

                            {editError && (
                                <div style={{
                                    padding: '0.75rem',
                                    borderRadius: '4px',
                                    backgroundColor: '#7f1d1d',
                                    border: '1px solid #ef4444',
                                }}>
                                    <p style={{ fontSize: '0.875rem', color: '#fecaca', margin: 0 }}>{editError}</p>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: '#e0e0e0',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isEditing}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: 'white',
                                        backgroundColor: '#3b82f6',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: isEditing ? 'not-allowed' : 'pointer',
                                        opacity: isEditing ? 0.6 : 1,
                                    }}
                                >
                                    {isEditing ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Revoke Confirmation Dialog */}
                <ConfirmDialog
                    isOpen={revokeConfirm.isOpen}
                    onClose={() => setRevokeConfirm({ isOpen: false, accessId: null, name: '' })}
                    onConfirm={() => revokeConfirm.accessId && handleRevokeAccess(revokeConfirm.accessId)}
                    title="Revoke Access"
                    message={`Are you sure you want to revoke access for "${revokeConfirm.name}"?`}
                    confirmText="Revoke"
                    cancelText="Cancel"
                    variant="danger"
                />
            </div>
        </Modal>
    );
}
