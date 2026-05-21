import type { ReactNode } from 'react';
import { Text } from '@/components/ui/typography';
import { Info } from 'lucide-react';

export function AdminEffectCallout(props: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 p-4">
      <div className="flex gap-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1 text-sm">
          <Text className="font-medium">{props.title}</Text>
          <div className="text-muted-foreground">{props.children}</div>
        </div>
      </div>
    </div>
  );
}
