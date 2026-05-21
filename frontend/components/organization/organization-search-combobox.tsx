"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import {
  searchOrganizations,
  type OrganizationSearchDto,
} from "@/lib/api/organizations";
import { labelOrgRoleShort } from "@/lib/game-labels";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/typography";

const DEBOUNCE_MS = 280;
const MIN_CHARS = 2;

export function OrganizationSearchCombobox() {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<OrganizationSearchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    const asId = /^\d+$/.test(q);
    if (!asId && q.length < MIN_CHARS) {
      setRows([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    setOpen(true);
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const byId = asId ? parseInt(q, 10) : undefined;
          const res = await searchOrganizations({
            q: asId ? undefined : q,
            id: byId,
          });
          setRows(res);
        } catch {
          setRows([]);
        } finally {
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="space-y-1">
      <label htmlFor={`${listId}-input`} className="text-sm font-medium">
        Поиск организации
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id={`${listId}-input`}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={`${listId}-listbox`}
          className="h-11 w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm"
          placeholder="Название или ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
        />
        {loading ? (
          <Loader2
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Очистить поиск"
            onClick={() => {
              setQuery("");
              setRows([]);
              setOpen(false);
            }}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
        {showPanel ? (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className={cn(
              "absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg",
            )}
          >
            {loading && rows.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Поиск…
              </li>
            ) : null}
            {!loading && rows.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Ничего не найдено
              </li>
            ) : null}
            {rows.map((r) => (
              <li key={r.id} role="option">
                <Link
                  href={`/organization/${r.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/80"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    setRows([]);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      ID {r.id}
                      {r.isMember
                        ? ` · вы ${labelOrgRoleShort(r.role)}`
                        : ""}
                      {!r.isActive ? " · неактивна" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-primary">Открыть</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

    </div>
  );
}
