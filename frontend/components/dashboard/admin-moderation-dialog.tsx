'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

export function AdminModerationDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  effectHint: React.ReactNode;
  confirmLabel: string;
  variant?: 'destructive' | 'secondary';
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) {
      setReason('');
      setError(null);
    }
  }, [props.open]);

  async function onSubmit() {
    const r = reason.trim();
    if (r.length < 3) {
      setError('Укажите причину не короче 3 символов');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await props.onConfirm(r);
      props.onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выполнить действие');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">{props.effectHint}</div>
        <div className="space-y-2">
          <label htmlFor="mod-reason" className="text-sm font-medium">
            Причина
          </label>
          <textarea
            id="mod-reason"
            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Например: нарушение правил трансляции"
          />
          {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            variant={props.variant ?? 'destructive'}
            disabled={saving}
            onClick={() => void onSubmit()}
          >
            {saving ? 'Сохранение…' : props.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
