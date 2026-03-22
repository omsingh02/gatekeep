import { useState, useEffect } from 'react';

/**
 * Debounces a value by delaying updates until after the specified delay has elapsed
 * since the last change. Useful for search inputs to avoid excessive API calls.
 * 
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Returns true if the viewport width is below the specified breakpoint.
 * Defaults to 768px (tablet breakpoint).
 * 
 * @param breakpoint - The width threshold in pixels (default: 768)
 * @returns Whether the viewport is below the breakpoint
 */
export function useIsMobile(breakpoint: number = 768): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Check initial value
        const checkMobile = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };
        
        checkMobile();

        // Listen for resize
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [breakpoint]);

    return isMobile;
}
