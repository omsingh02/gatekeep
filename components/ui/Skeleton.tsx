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
        backgroundColor: '#23263a',
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
