'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { leaveOrganization } from '@/lib/api/organizations';
import toast from 'react-hot-toast';

export function OrganizationLeaveButton(props: {
  organizationId: number;
  isOwner: boolean;
  isMember: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  if (!props.isMember || props.isOwner) {
    if (props.isOwner) {
      return (
        <Text className="text-xs text-muted-foreground">
          Владелец клуба не может покинуть организацию — только удалить её в настройках.
        </Text>
      );
    }
    return null;
  }

  async function onLeave() {
    setLeaving(true);
    try {
      await leaveOrganization(props.organizationId);
      toast.success('Вы покинули организацию');
      router.push('/dashboard/organizations');
    } finally {
      setLeaving(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={props.className}
      disabled={leaving}
      onClick={() => void onLeave()}
    >
      <LogOut className="size-4" aria-hidden />
      {leaving ? 'Выход…' : 'Покинуть организацию'}
    </Button>
  );
}
