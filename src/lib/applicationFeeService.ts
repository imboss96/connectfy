import { requireAccessToken, requestJson } from './mpesaPayoutService';

export type ApplicationFeeCheckout = {
  id: string;
  status: 'pending' | 'initiating' | 'paid' | 'applied' | 'failed' | 'expired' | 'refund_pending' | 'refunded';
  amountKes: number;
  holdExpiresAt?: string;
  failureReason?: string;
};

export type AdminApplicationFeePayment = {
  id: string;
  project_id: string;
  project_title: string;
  tester_id: string;
  tester_name: string;
  tester_email: string;
  amount_kes: number;
  phone_number: string;
  status: ApplicationFeeCheckout['status'];
  refund_status: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
  mpesa_receipt: string | null;
  created_at: string;
  refund_failure_reason: string | null;
};

export async function beginApplicationFeeCheckout(projectId: string, phoneNumber: string): Promise<ApplicationFeeCheckout> {
  const token = await requireAccessToken();
  const result = await requestJson<{ checkout: Record<string, unknown> }>('/api/application-fee-checkouts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, phoneNumber, termsAccepted: true })
  });
  return mapCheckout(result.checkout);
}

export async function fetchApplicationFeeCheckout(paymentId: string): Promise<ApplicationFeeCheckout> {
  const token = await requireAccessToken();
  const result = await requestJson<{ checkout: Record<string, unknown> }>(
    `/api/application-fee-checkouts/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return mapCheckout(result.checkout);
}

export async function fetchProjectApplicationFeeCheckout(projectId: string): Promise<ApplicationFeeCheckout | null> {
  const token = await requireAccessToken();
  const result = await requestJson<{ checkout: Record<string, unknown> | null }>(
    `/api/application-fee-checkouts?projectId=${encodeURIComponent(projectId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return result.checkout ? mapCheckout(result.checkout) : null;
}

export async function waitForApplicationFeePayment(paymentId: string): Promise<ApplicationFeeCheckout> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const checkout = await fetchApplicationFeeCheckout(paymentId);
    if (checkout.status !== 'pending' && checkout.status !== 'initiating') return checkout;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error('Payment is still pending. If you approved the M-Pesa prompt, wait a moment and submit again to check its status.');
}

export async function fetchAdminApplicationFeePayments(): Promise<AdminApplicationFeePayment[]> {
  const token = await requireAccessToken();
  const result = await requestJson<{ payments: AdminApplicationFeePayment[] }>('/api/admin/application-fee-payments', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return result.payments;
}

export async function refundApplicationFeePayment(paymentId: string): Promise<void> {
  const token = await requireAccessToken();
  await requestJson(`/api/admin/application-fee-payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

function mapCheckout(row: Record<string, unknown>): ApplicationFeeCheckout {
  return {
    id: String(row.id),
    status: row.status as ApplicationFeeCheckout['status'],
    amountKes: Number(row.amount_kes),
    holdExpiresAt: typeof row.hold_expires_at === 'string' ? row.hold_expires_at : undefined,
    failureReason: typeof row.failure_reason === 'string' ? row.failure_reason : undefined
  };
}
