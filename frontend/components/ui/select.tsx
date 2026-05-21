'use client';

import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectOption = { value: string; label: string };

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Выберите…',
  className,
  disabled,
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative min-w-[10rem]', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors',
          'hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none',
          disabled && 'pointer-events-none opacity-50',
        )}>
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value || '__empty'} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    active
                      ? 'bg-primary/10 text-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                  )}
                  onClick={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}>
                  <span className="truncate">{opt.label}</span>
                  {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
