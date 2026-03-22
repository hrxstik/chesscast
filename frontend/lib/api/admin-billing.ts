import { apiFetch } from './client';

export type BillingSummaryDto = {
  revenue: string;
  currency: string;
  paymentCount: number;
  refunds: number;
};

export type BillingEventRow = {
  id: number;
  type: string;
  amount: string | null;
  currency: string | null;
  createdAt: string;
  paymentId: number | null;
  payment: { id: number; status: string; purpose: string } | null;
  actor: { id: number; name: string; email: string } | null;
  metadata: unknown;
};

export type BillingEventsResponse = {
  items: BillingEventRow[];
  nextCursor: number | null;
};

export async function fetchBillingSummary(params?: {
  from?: string;
  to?: string;
}): Promise<BillingSummaryDto> {
  const sp = new URLSearchParams();
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  const q = sp.toString();
  return apiFetch<BillingSummaryDto>(`/admin/billing/summary${q ? `?${q}` : ''}`);
}

export async function fetchBillingEvents(params?: {
  cursor?: number;
  limit?: number;
}): Promise<BillingEventsResponse> {
  const sp = new URLSearchParams();
  if (params?.cursor != null) sp.set('cursor', String(params.cursor));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const q = sp.toString();
  return apiFetch<BillingEventsResponse>(`/admin/billing/events${q ? `?${q}` : ''}`);
}
