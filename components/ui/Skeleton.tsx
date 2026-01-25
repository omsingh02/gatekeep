interface SkeletonProps {
    className?: string;
    width?: string;
    height?: string;
    variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ 
    className = '', 
    width, 
    height,
    variant = 'rectangular' 
}: SkeletonProps) {
    const baseStyles: React.CSSProperties = {
        backgroundColor: '#3a3a3a',
        animation: 'pulse 1.5s ease-in-out infinite',
        width: width || '100%',
        height: height || (variant === 'text' ? '1em' : '100%'),
        borderRadius: variant === 'circular' ? '50%' : variant === 'text' ? '4px' : '6px',
    };

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
            <div className={className} style={baseStyles} />
        </>
    );
}

// Pre-built skeleton patterns for common use cases
export function FileListSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.from({ length: count }).map((_, i) => (
                <div 
                    key={i}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '6px',
                        border: '1px solid #3a3a3a',
                    }}
                >
                    <Skeleton width="40px" height="40px" />
                    <div style={{ flex: 1 }}>
                        <Skeleton variant="text" width="60%" height="1rem" />
                        <div style={{ marginTop: '0.5rem' }}>
                            <Skeleton variant="text" width="30%" height="0.75rem" />
                        </div>
                    </div>
                    <Skeleton width="80px" height="32px" />
                </div>
            ))}
        </div>
    );
}

export function StatCardSkeleton() {
    return (
        <div style={{
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            padding: '1.5rem',
            border: '1px solid #3a3a3a',
        }}>
            <Skeleton variant="text" width="40%" height="0.875rem" />
            <div style={{ marginTop: '0.5rem' }}>
                <Skeleton variant="text" width="60%" height="1.875rem" />
            </div>
        </div>
    );
}
