'use client';

import React from 'react';

type IllustrationType = 
    | 'no-files' 
    | 'no-results' 
    | 'no-access' 
    | 'no-data' 
    | 'empty-folder'
    | 'upload';

interface EmptyStateProps {
    type: IllustrationType;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

// SVG Illustrations
const illustrations: Record<IllustrationType, React.ReactNode> = {
    'no-files': (
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Stack of papers/files */}
            <rect x="25" y="45" width="50" height="40" rx="4" fill="#12141c" stroke="#2f3349" strokeWidth="2"/>
            <rect x="30" y="40" width="50" height="40" rx="4" fill="#12141c" stroke="#2f3349" strokeWidth="2"/>
            <rect x="35" y="35" width="50" height="40" rx="4" fill="#0f1117" stroke="#23263a" strokeWidth="2"/>
            {/* Lines on paper */}
            <line x1="42" y1="48" x2="78" y2="48" stroke="#23263a" strokeWidth="2" strokeLinecap="round"/>
            <line x1="42" y1="55" x2="70" y2="55" stroke="#23263a" strokeWidth="2" strokeLinecap="round"/>
            <line x1="42" y1="62" x2="65" y2="62" stroke="#23263a" strokeWidth="2" strokeLinecap="round"/>
            {/* Decorative dots */}
            <circle cx="95" cy="25" r="3" fill="#6366f1" opacity="0.5"/>
            <circle cx="15" cy="60" r="2" fill="#10b981" opacity="0.5"/>
            <circle cx="105" cy="70" r="4" fill="#8b5cf6" opacity="0.3"/>
        </svg>
    ),
    'no-results': (
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Magnifying glass */}
            <circle cx="50" cy="45" r="25" fill="#0f1117" stroke="#23263a" strokeWidth="3"/>
            <circle cx="50" cy="45" r="18" fill="#12141c" stroke="#2f3349" strokeWidth="2"/>
            <line x1="68" y1="63" x2="85" y2="80" stroke="#23263a" strokeWidth="6" strokeLinecap="round"/>
            {/* Question marks or dots inside */}
            <circle cx="43" cy="42" r="2" fill="#2f3349"/>
            <circle cx="50" cy="42" r="2" fill="#2f3349"/>
            <circle cx="57" cy="42" r="2" fill="#2f3349"/>
            {/* Decorative elements */}
            <path d="M90 25 L95 30 L100 25" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
            <circle cx="20" cy="70" r="3" fill="#6366f1" opacity="0.4"/>
        </svg>
    ),
    'no-access': (
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Lock body */}
            <rect x="38" y="42" width="44" height="35" rx="6" fill="#0f1117" stroke="#23263a" strokeWidth="2"/>
            {/* Lock shackle */}
            <path d="M47 42 V32 C47 22 53 16 60 16 C67 16 73 22 73 32 V42" stroke="#23263a" strokeWidth="4" fill="none" strokeLinecap="round"/>
            {/* Keyhole */}
            <circle cx="60" cy="55" r="5" fill="#23263a"/>
            <rect x="58" y="55" width="4" height="10" fill="#23263a"/>
            {/* Sparkles */}
            <path d="M25 35 L28 38 L25 41 L22 38 Z" fill="#6366f1" opacity="0.5"/>
            <circle cx="95" cy="50" r="3" fill="#10b981" opacity="0.4"/>
            <path d="M90 75 L93 78 L90 81 L87 78 Z" fill="#8b5cf6" opacity="0.4"/>
        </svg>
    ),
    'no-data': (
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Chart bars */}
            <rect x="22" y="60" width="14" height="25" rx="3" fill="#12141c" stroke="#23263a" strokeWidth="2"/>
            <rect x="42" y="45" width="14" height="40" rx="3" fill="#12141c" stroke="#23263a" strokeWidth="2"/>
            <rect x="62" y="55" width="14" height="30" rx="3" fill="#12141c" stroke="#23263a" strokeWidth="2"/>
            <rect x="82" y="35" width="14" height="50" rx="3" fill="#12141c" stroke="#23263a" strokeWidth="2"/>
            {/* Baseline */}
            <line x1="15" y1="88" x2="105" y2="88" stroke="#23263a" strokeWidth="2" strokeLinecap="round"/>
            {/* Empty indicator - dashed line */}
            <line x1="20" y1="30" x2="100" y2="30" stroke="#2f3349" strokeWidth="2" strokeDasharray="4 4" opacity="0.5"/>
            {/* Decorative */}
            <circle cx="105" cy="20" r="3" fill="#6366f1" opacity="0.5"/>
        </svg>
    ),
    'empty-folder': (
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Folder back */}
            <path d="M20 35 L20 75 C20 78 22 80 25 80 L95 80 C98 80 100 78 100 75 L100 40 C100 37 98 35 95 35 L55 35 L48 25 L25 25 C22 25 20 27 20 30 L20 35Z" fill="#0f1117" stroke="#23263a" strokeWidth="2"/>
            {/* Folder front flap */}
            <path d="M20 40 L100 40 L100 75 C100 78 98 80 95 80 L25 80 C22 80 20 78 20 75 L20 40Z" fill="#12141c" stroke="#2f3349" strokeWidth="2"/>
            {/* Decorative dashed lines inside (empty indicator) */}
            <line x1="35" y1="55" x2="55" y2="55" stroke="#23263a" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round"/>
            <line x1="35" y1="65" x2="70" y2="65" stroke="#23263a" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round"/>
            {/* Sparkles */}
            <circle cx="108" cy="30" r="4" fill="#818cf8" opacity="0.4"/>
            <circle cx="12" cy="55" r="3" fill="#10b981" opacity="0.4"/>
        </svg>
    ),
    'upload': (
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Cloud shape */}
            <path d="M85 55 C85 55 95 55 95 45 C95 35 85 30 75 33 C75 23 65 15 52 18 C40 20 35 30 35 38 C25 38 20 48 25 55 C20 62 25 72 35 72 L85 72 C95 72 100 62 95 55 C100 48 95 40 85 45 L85 55Z" fill="#0f1117" stroke="#23263a" strokeWidth="2"/>
            {/* Upload arrow */}
            <path d="M60 65 L60 42" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
            <path d="M50 52 L60 42 L70 52" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Plus sign particles */}
            <path d="M25 25 L25 32 M21.5 28.5 L28.5 28.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
            <circle cx="95" cy="25" r="3" fill="#8b5cf6" opacity="0.4"/>
        </svg>
    ),
};

export function EmptyState({ type, title, description, action }: EmptyStateProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3rem 1.5rem',
            textAlign: 'center',
        }}>
            <div style={{
                marginBottom: '1.5rem',
                opacity: 0.9,
            }}>
                {illustrations[type]}
            </div>
            <h3 style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: '#e0e0e0',
                margin: 0,
                marginBottom: description ? '0.5rem' : 0,
            }}>
                {title}
            </h3>
            {description && (
                <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    margin: 0,
                    maxWidth: '300px',
                }}>
                    {description}
                </p>
            )}
            {action && (
                <div style={{ marginTop: '1.25rem' }}>
                    {action}
                </div>
            )}
        </div>
    );
}
