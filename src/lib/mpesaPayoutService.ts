import { PayoutQuote, PayoutRequest } from '../types';
import { supabase } from './supabase';

const backendUrl = () => {
  const configuredUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EMAIL_BACKEND_URL)
    || 'http://localhost:3002/api/project-email';
  const url = new URL(configuredUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
};

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(new URL(path, backendUrl()), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const body = await response.text();
  let result: Record<string, unknown> = {};
  if (body) {
    try {
      result = JSON.parse(body);
    } catch {
      throw new Error('Payment service returned an invalid response.');
    }
  }
  if (!response.ok) {
    throw new Error(typeof result.message === 'string' ? result.message : 'Payment service request failed.');
  }
  return result as T;
}

export async function fetchMpesaPayoutQuote(usdAmount: number): Promise<PayoutQuote> {
  return requestJson<PayoutQuote>(`/api/mpesa/quote?usdAmount=${encodeURIComponent(usdAmount)}`);
}

export async function submitPayoutRequest(input: {
  amount: number;
  method: PayoutRequest['method'];
  destinationAccount: string;
}): Promise<PayoutRequest> {
  if (!supabase) throw new Error('Sign in before submitting a payout request.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Your session has expired. Sign in again to request a payout.');

  const result = await requestJson<{ payout: Record<string, unknown> }>('/api/payout-requests', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input)
  });
  const row = result.payout;
  return {
    id: String(row.id),
    testerId: String(row.tester_id),
    amount: Number(row.amount),
    method: row.method as PayoutRequest['method'],
    destinationAccount: String(row.destination_account),
    status: row.status as PayoutRequest['status'],
    requestedAt: String(row.requested_at),
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : undefined,
    transactionRef: String(row.transaction_ref),
    currency: String(row.currency || 'USD'),
    exchangeRate: row.exchange_rate == null ? undefined : Number(row.exchange_rate),
    exchangeRateSource: typeof row.exchange_rate_source === 'string' ? row.exchange_rate_source : undefined,
    exchangeRateAt: typeof row.exchange_rate_at === 'string' ? row.exchange_rate_at : undefined,
    kesAmount: row.kes_amount == null ? undefined : Number(row.kes_amount),
    approvedKesAmount: row.approved_kes_amount == null ? undefined : Number(row.approved_kes_amount),
    failureReason: typeof row.failure_reason === 'string' ? row.failure_reason : undefined
  };
}

export async function fetchPendingPayoutRequests(): Promise<Record<string, unknown>[]> {
  const token = await requireAccessToken();
  const result = await requestJson<{ payouts: Record<string, unknown>[] }>('/api/admin/payout-requests', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return result.payouts;
}

export async function approvePayoutRequest(payoutId: string, approvedKesAmount?: number): Promise<void> {
  const token = await requireAccessToken();
  await requestJson(`/api/admin/payout-requests/${encodeURIComponent(payoutId)}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ approvedKesAmount })
  });
}

async function requireAccessToken() {
  if (!supabase) throw new Error('Payment service is unavailable until Supabase is configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Your session has expired. Sign in again.');
  return data.session.access_token;
}
