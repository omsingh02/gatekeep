import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from './cn';

/** Scroll container + table. Put it inside a flush Card. */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
    return (
        <div className="relative w-full overflow-x-auto">
            <table className={cn('w-full border-collapse text-left text-body-sm', className)} {...props}>
                {children}
            </table>
        </div>
    );
}

/** Sticky header row (sentence case, caption size). */
export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn('sticky top-0 z-10 bg-surface', className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn('[&>tr:last-child]:border-b-0', className)} {...props} />;
}

export interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
    selected?: boolean;
    /** Make the whole row look clickable (hover state) */
    interactive?: boolean;
}

export function TR({ selected, interactive, className, ...props }: TRProps) {
    return (
        <tr
            aria-selected={selected || undefined}
            className={cn(
                'h-11 border-b border-subtle transition-colors',
                interactive && 'cursor-pointer hover:bg-raised',
                selected && 'bg-raised',
                className
            )}
            {...props}
        />
    );
}

export type SortDirection = 'asc' | 'desc' | null;

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
    numeric?: boolean;
    /** Makes the header a sort button. `sort` is this column's current direction (null = unsorted). */
    onSort?: () => void;
    sort?: SortDirection;
}

export function TH({ numeric, onSort, sort = null, className, children, ...props }: THProps) {
    const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ArrowUpDown;
    return (
        <th
            scope="col"
            aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : onSort ? 'none' : undefined}
            className={cn(
                'h-9 whitespace-nowrap border-b border-default px-3 text-caption font-medium text-secondary first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5',
                numeric && 'text-right',
                className
            )}
            {...props}
        >
            {onSort ? (
                <button
                    type="button"
                    onClick={onSort}
                    className={cn('inline-flex items-center gap-1 rounded-sm hover:text-primary focus-ring', numeric && 'flex-row-reverse', sort && 'text-primary')}
                >
                    {children}
                    <Icon aria-hidden strokeWidth={1.75} className={cn('h-3.5 w-3.5', !sort && 'opacity-50')} />
                </button>
            ) : (
                children
            )}
        </th>
    );
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
    numeric?: boolean;
    /** Primary cell text (strong colour) */
    strong?: boolean;
}

export function TD({ numeric, strong, className, ...props }: TDProps) {
    return (
        <td
            className={cn(
                'px-3 py-2 align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5',
                strong ? 'text-primary' : 'text-secondary',
                numeric && 'text-right tabular-nums',
                className
            )}
            {...props}
        />
    );
}

/** A full-width row for "No results" inside a table body. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-5 py-10 text-center text-body-sm text-secondary">
                {children}
            </td>
        </tr>
    );
}
