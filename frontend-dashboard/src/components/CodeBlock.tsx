'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

// Code block with copy-to-clipboard button
export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-brand-800 bg-brand-950/95 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-brand-900/60 border-b border-brand-800/80 text-[11px] font-mono text-brand-300">
        <span>{language ? language.toUpperCase() : 'CODE / TELEMETRY'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-800 hover:bg-brand-700 text-brand-200 transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-xs font-mono text-brand-100 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
