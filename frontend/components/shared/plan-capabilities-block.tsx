import { Check, X } from 'lucide-react';
import { Text } from '@/components/ui/typography';
import {
  describePlanLimits,
  type PlanLimitsDto,
} from '@/lib/plan-capabilities';

type Props = {
  features: string[];
  limits: PlanLimitsDto;
};

export function PlanCapabilitiesBlock({ features, limits }: Props) {
  const { capabilities, limitations } = describePlanLimits(limits);

  return (
    <div className="space-y-4 text-sm">
      {features.length > 0 ? (
        <div>
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            В тарифе
          </Text>
          <ul className="mt-2 space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex gap-2 text-foreground/90">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Возможности
        </Text>
        <ul className="mt-2 space-y-1.5">
          {capabilities.map((c) => (
            <li key={c} className="flex gap-2 text-foreground/90">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      </div>

      {limitations.length > 0 ? (
        <div>
          <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ограничения
          </Text>
          <ul className="mt-2 space-y-1.5">
            {limitations.map((l) => (
              <li key={l} className="flex gap-2 text-muted-foreground">
                <X className="mt-0.5 size-4 shrink-0 text-destructive/80" aria-hidden />
                {l}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
