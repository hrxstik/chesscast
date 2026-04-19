import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CheckoutPlanButton } from '@/components/pricing/checkout-plan-button';

interface Props {
  className?: string;
  planId: number;
  planCode: string;
  title: string;
  price: string;
  description: string;
  features: string[];
}

export const PlanCard: React.FC<Props> = ({
  planId,
  planCode,
  title,
  price,
  description,
  features,
  className,
}) => {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <p className="text-3xl font-bold tracking-tight">{price}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {features.map((feature) => (
            <li key={feature} className="flex gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <CheckoutPlanButton
          planId={planId}
          planCode={planCode}
          aria-label={planCode === 'FREE' ? `Регистрация — ${title}` : `Оформить ${title}`}
        />
      </CardFooter>
    </Card>
  );
};
