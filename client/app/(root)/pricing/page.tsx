import { PlanCard } from '@/components/shared/plan-card';
import { Title } from '@/components/shared/title';
import { fetchPlans } from '@/lib/api/plans';
import React from 'react';

export interface Plan {
  title: string;
  price: string;
  description: string;
  features: string[];
}

export default async function PricingPage() {
  const plans: Plan[] = await fetchPlans();

  return (
    <div className="min-h-[90vh] flex items-center justify-center">
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto text-center mb-14">
          <Title
            className="dark:text-primary text-primary text-4xl font-extrabold mb-4"
            size="xl"
            text="Цены на подписки"
          />
          <p className="dark:text-primary text-primary text-lg max-w-xl mx-auto">
            Выберите план, который подходит именно вам и улучшите свои навыки в шахматах с
            ChessCast.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 max-w-7xl mx-auto">
          {plans.map(({ title, price, description, features }) => (
            <PlanCard
              key={title}
              title={title}
              price={price}
              description={description}
              features={features}
              className="bg-white dark:bg-card rounded-lg shadow p-8 flex flex-col"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
