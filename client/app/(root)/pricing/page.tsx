'use client';

import { PlanCard } from '@/components/shared/plan-card';
import { usePricingStore } from '@/store/pricing';
import Link from 'next/link';
import React from 'react';

export default function PricingPage() {
  const plans = usePricingStore((state) => state.plans);
  return (
    <div className="min-h-[90vh] flex items-center justify-center">
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto text-center mb-14">
          <h1 className="dark:text-primary text-primary text-4xl font-extrabold mb-4">
            Цены на подписки
          </h1>
          <p className="dark:text-primary text-primary text-lg max-w-xl mx-auto">
            Выберите план, который подходит именно вам и улучшите свои навыки в шахматах с
            ChessCast.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 max-w-7xl mx-auto">
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
