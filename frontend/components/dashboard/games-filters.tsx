'use client';

import { Select } from '@/components/ui/select';
import { Filter } from 'lucide-react';

export const GAMES_STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'PENDING', label: 'Ожидает начала' },
  { value: 'IN_PROGRESS', label: 'Идёт трансляция' },
  { value: 'FINISHED', label: 'Завершена' },
];

export const GAMES_RESULT_OPTIONS = [
  { value: '', label: 'Любой исход' },
  { value: 'WHITE_WIN', label: 'Победа белых' },
  { value: 'BLACK_WIN', label: 'Победа чёрных' },
  { value: 'DRAW', label: 'Ничья' },
  { value: 'CANCELLED', label: 'Отменена' },
  { value: 'WHITE_RESIGN', label: 'Сдались белые' },
  { value: 'BLACK_RESIGN', label: 'Сдались чёрные' },
];

export type GamesFilterValues = {
  status: string;
  result: string;
  token: string;
  from: string;
  to: string;
};

export function GamesFiltersBar(props: {
  values: GamesFilterValues;
  onChange: (patch: Partial<GamesFilterValues>) => void;
  compact?: boolean;
}) {
  const { values, onChange, compact } = props;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'pt-2'}`}>
      <Filter
        className={`size-4 text-muted-foreground ${compact ? '' : 'mb-2 md:mb-0'}`}
        aria-hidden
      />
      <Select
        value={values.status}
        onValueChange={(status) => onChange({ status })}
        options={GAMES_STATUS_OPTIONS}
        placeholder="Статус"
        aria-label="Фильтр по статусу"
      />
      <Select
        value={values.result}
        onValueChange={(result) => onChange({ result })}
        options={GAMES_RESULT_OPTIONS}
        placeholder="Исход"
        aria-label="Фильтр по исходу"
      />
      <input
        className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm shadow-xs"
        placeholder="Токен"
        value={values.token}
        onChange={(e) => onChange({ token: e.target.value })}
      />
      <input
        className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs"
        type="date"
        value={values.from}
        onChange={(e) => onChange({ from: e.target.value })}
        aria-label="Дата с"
      />
      <input
        className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs"
        type="date"
        value={values.to}
        onChange={(e) => onChange({ to: e.target.value })}
        aria-label="Дата по"
      />
    </div>
  );
}
