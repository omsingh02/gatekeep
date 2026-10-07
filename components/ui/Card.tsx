import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export function Card({ children, className = '' }: CardProps) {
    return (
        <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 ${className}`}>
            {children}
        </div>
    );
}
