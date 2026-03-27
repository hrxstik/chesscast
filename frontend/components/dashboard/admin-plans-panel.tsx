'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { ApiError } from '@/lib/api/types';
import {
  createPlan,
  disablePlan,
  fetchAdminPlans,
  updatePlan,
  type AdminPlanDto,
  type StreamQualityLevel,
} from '@/lib/api/admin-plans';

type PlanFormState = {
  code: string;
  title: string;
  description: string;
  featuresCsv: string;
  maxGamesPerPeriod: string;
  maxOrganizations: string;
  canCreateOrganization: boolean;
  canStream: boolean;
  streamQualityLevel: StreamQualityLevel;
  priceMonthly: string;
  currency: string;
};

const initialForm: PlanFormState = {
  code: '',
  title: '',
  description: '',
  featuresCsv: '',
  maxGamesPerPeriod: '100',
  maxOrganizations: '1',
  canCreateOrganization: false,
  canStream: true,
  streamQualityLevel: 'MEDIUM',
  priceMonthly: '0.00',
  currency: 'RUB',
};

export function AdminPlansPanel() {
  const [plans, setPlans] = useState<AdminPlanDto[]>([]);
  const [form, setForm] = useState<PlanFormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlans() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAdminPlans();
      setPlans(rows);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Не удалось загрузить тарифы (нужен вход супер-админа).',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  async function onCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createPlan({
        code: form.code,
        title: form.title,
        description: form.description,
        features: form.featuresCsv
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        maxGamesPerPeriod: Number(form.maxGamesPerPeriod),
        maxOrganizations: Number(form.maxOrganizations),
        canCreateOrganization: form.canCreateOrganization,
        canStream: form.canStream,
        streamQualityLevel: form.streamQualityLevel,
        priceMonthly: form.priceMonthly,
        currency: form.currency,
        isActive: true,
      });
      setForm(initialForm);
      await loadPlans();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось создать тариф');
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(plan: AdminPlanDto) {
    try {
      if (plan.isActive) {
        await disablePlan(plan.id);
      } else {
        await updatePlan(plan.id, { isActive: true });
      }
      await loadPlans();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось обновить тариф');
    }
  }

  if (loading) return <Text className="text-sm text-muted-foreground">Загрузка тарифов…</Text>;

  return (
    <div className="space-y-5">
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      <div className="rounded-lg border border-border">
        <div className="border-b border-border px-4 py-2">
          <Text className="text-sm font-medium">Тарифные планы</Text>
        </div>
        <ul className="divide-y divide-border text-sm">
          {plans.length === 0 ? (
            <li className="px-4 py-4 text-muted-foreground">Тарифов пока нет</li>
          ) : (
            plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-14 rounded border border-border px-2 py-0.5 text-xs font-mono">
                  {p.code}
                </span>
                <span className="font-medium">{p.title}</span>
                <span className="text-muted-foreground">
                  {p.priceMonthly} {p.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  игр: {p.maxGamesPerPeriod}, орг: {p.maxOrganizations}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="ml-auto h-8 text-xs"
                  onClick={() => void onToggleActive(p)}>
                  {p.isActive ? 'Деактивировать' : 'Активировать'}
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>

      <form onSubmit={onCreatePlan} className="space-y-3 rounded-lg border border-border p-4">
        <Text className="text-sm font-medium">Создать тариф</Text>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="CODE (например PREMIUM)"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            required
          />
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Название"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Цена в месяц, например 299.00"
            value={form.priceMonthly}
            onChange={(e) => setForm((f) => ({ ...f, priceMonthly: e.target.value }))}
            required
          />
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Валюта (RUB)"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          />
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Лимит игр"
            value={form.maxGamesPerPeriod}
            onChange={(e) => setForm((f) => ({ ...f, maxGamesPerPeriod: e.target.value }))}
            required
          />
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            placeholder="Лимит организаций"
            value={form.maxOrganizations}
            onChange={(e) => setForm((f) => ({ ...f, maxOrganizations: e.target.value }))}
            required
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.streamQualityLevel}
            onChange={(e) =>
              setForm((f) => ({ ...f, streamQualityLevel: e.target.value as StreamQualityLevel }))
            }>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
            placeholder="Описание"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
            placeholder="Фичи через запятую"
            value={form.featuresCsv}
            onChange={(e) => setForm((f) => ({ ...f, featuresCsv: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.canCreateOrganization}
              onChange={(e) =>
                setForm((f) => ({ ...f, canCreateOrganization: e.target.checked }))
              }
            />
            Можно создавать организации
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.canStream}
              onChange={(e) => setForm((f) => ({ ...f, canStream: e.target.checked }))}
            />
            Можно стримить
          </label>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? 'Создание…' : 'Создать тариф'}
        </Button>
      </form>
    </div>
  );
}
