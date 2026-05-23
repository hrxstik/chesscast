'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { X } from 'lucide-react';
import { submitCreateGame } from '@/lib/create-game-form';
import { ApiError } from '@/lib/api/types';
import {
  fetchOrganizationMembers,
  type OrganizationMemberDto,
} from '@/lib/api/organizations';
import { notifyError } from '@/lib/notify';
import toast from 'react-hot-toast';

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Закрытая' },
  { value: 'PUBLIC', label: 'Публичная' },
];

const EMPTY_PLAYER = '';

type Props = {
  open: boolean;
  onClose: () => void;
  organizationId?: number;
};

export function CreateGameModal({ open, onClose, organizationId }: Props) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<OrganizationMemberDto[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [whitePlayerId, setWhitePlayerId] = useState(EMPTY_PLAYER);
  const [blackPlayerId, setBlackPlayerId] = useState(EMPTY_PLAYER);

  useEffect(() => {
    if (!open || organizationId == null) {
      setMembers([]);
      setWhitePlayerId(EMPTY_PLAYER);
      setBlackPlayerId(EMPTY_PLAYER);
      return;
    }
    let mounted = true;
    setMembersLoading(true);
    void fetchOrganizationMembers(organizationId)
      .then((rows) => {
        if (mounted) setMembers(rows);
      })
      .catch(() => {
        if (mounted) setMembers([]);
      })
      .finally(() => {
        if (mounted) setMembersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [open, organizationId]);

  if (!open) return null;

  const memberOptions = [
    { value: EMPTY_PLAYER, label: 'Не выбран' },
    ...members.map((m) => ({
      value: String(m.userId),
      label: m.user.name,
    })),
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current || loading) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const white =
        whitePlayerId !== EMPTY_PLAYER ? Number(whitePlayerId) : undefined;
      const black =
        blackPlayerId !== EMPTY_PLAYER ? Number(blackPlayerId) : undefined;
      if (white != null && black != null && white === black) {
        notifyError('Выберите разных игроков для белых и черных');
        submittingRef.current = false;
        setLoading(false);
        return;
      }
      const game = await submitCreateGame(visibility, organizationId, {
        whitePlayerId: white,
        blackPlayerId: black,
      });
      toast.success('Партия создана');
      onClose();
      router.push(`/game/watch/${game.token}`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Не удалось создать игру';
      notifyError(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-game-title">
      <Card className="relative w-full max-w-lg border-border/80 shadow-lg">
        <Button
          type="button"
          variant="ghost"
          className="absolute right-2 top-2 !h-9 !min-h-9 !w-9 !min-w-9 !p-0"
          aria-label="Закрыть"
          disabled={loading}
          onClick={onClose}>
          <X className="size-4" />
        </Button>
        <CardHeader className="pr-12">
          <CardTitle id="create-game-title">Создать игру</CardTitle>
          {organizationId != null ? (
            <Text className="text-sm font-normal text-muted-foreground">
              Партия будет привязана к организации.
            </Text>
          ) : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="create-game-visibility" className="text-sm font-medium">
                Видимость
              </label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as 'PRIVATE' | 'PUBLIC')}
                options={VISIBILITY_OPTIONS}
                disabled={loading}
                aria-label="Видимость партии"
              />
            </div>
            {organizationId != null ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="create-game-white" className="text-sm font-medium">
                    Белые
                  </label>
                  <Select
                    id="create-game-white"
                    value={whitePlayerId}
                    onValueChange={setWhitePlayerId}
                    options={memberOptions}
                    disabled={loading || membersLoading}
                    aria-label="Игрок белыми"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="create-game-black" className="text-sm font-medium">
                    Черные
                  </label>
                  <Select
                    id="create-game-black"
                    value={blackPlayerId}
                    onValueChange={setBlackPlayerId}
                    options={memberOptions}
                    disabled={loading || membersLoading}
                    aria-label="Игрок черными"
                  />
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? 'Создание…' : 'Создать'}
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
                Отмена
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
