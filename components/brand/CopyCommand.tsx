'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyCommand({ command, className = '' }: { command: string; className?: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard unavailable (e.g. insecure context): the command is still selectable
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            className={`group inline-flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 font-mono text-[13px] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] ${className}`}
            aria-label={`Copy command: ${command}`}
        >
            <span className="select-all">
                <span className="text-zinc-500">$</span> {command}
            </span>
            {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
                <Copy className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-zinc-300" />
            )}
        </button>
    );
}
