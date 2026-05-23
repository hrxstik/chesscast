'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { finishGame, type FinishGameResult } from '@/lib/api/games';
import { notifyError } from '@/lib/notify';
import toast from 'react-hot-toast';
import { ApiError } from '@/lib/api/types';
import type { GameSessionPublic } from '@/lib/api/game-session';

const RESULT_OPTIONS: { value: FinishGameResult; label: string }[] = [
  { value: 'WHITE_WIN', label: 'Победа белых' },
  { value: 'BLACK_WIN', label: 'Победа чёрных' },
  { value: 'DRAW', label: 'Ничья' },
  { value: 'STALEMATE', label: 'Пат' },
  { value: 'WHITE_RESIGN', label: 'Белые сдались' },
  { value: 'BLACK_RESIGN', label: 'Чёрные сдались' },
  { value: 'WHITE_TIME_OUT', label: 'У белых закончилось время' },
  { value: 'BLACK_TIME_OUT', label: 'У чёрных закончилось время' },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameToken: string;
  onFinished: (session: GameSessionPublic) => void;
};

export function FinishGameDialog({ open, onOpenChange, gameToken, onFinished }: Props) {
  const [result, setResult] = useState<FinishGameResult>('WHITE_WIN');
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    setSaving(true);
    try {
      const session = await finishGame(gameToken, result);
      toast.success('Партия завершена');
      onFinished(session);
      onOpenChange(false);
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Не удалось завершить партию');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Завершить партию</DialogTitle>
          <DialogDescription>
            Укажите исход вручную. При мате на доске партия завершается автоматически.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="finish-result" className="text-sm font-medium">
            Исход
          </label>
          <Select
            value={result}
            onValueChange={(v) => setResult(v as FinishGameResult)}
            options={RESULT_OPTIONS}
            disabled={saving}
            aria-label="Исход партии"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={saving}>
            {saving ? 'Сохранение…' : 'Завершить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
