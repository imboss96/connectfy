import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Send, Wallet } from 'lucide-react';
import { approvePayoutRequest, fetchPendingPayoutRequests } from '../lib/mpesaPayoutService';

type PayoutRow = {
  id: string;
  tester_id: string;
  amount: number;
  method: string;
  destination_account: string;
  status: string;
  transaction_ref: string;
  requested_at: string;
  exchange_rate?: number | null;
  exchange_rate_source?: string | null;
  exchange_rate_at?: string | null;
  kes_amount?: number | null;
  tester?: { id: string; name: string; email: string; profile_data?: Record<string, unknown> } | null;
};

export const PayoutOperationsSection: React.FC = () => {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const rows = await fetchPendingPayoutRequests() as PayoutRow[];
      setPayouts(rows);
      setApprovedAmounts((current) => Object.fromEntries(rows.map((row) => [
        row.id,
        current[row.id] || String(row.kes_amount || '')
      ])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load payout requests.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const approve = async (payout: PayoutRow) => {
    setError('');
    setNotice('');
    setBusyId(payout.id);
    try {
      const amount = payout.method === 'Safaricom M-Pesa'
        ? Number(approvedAmounts[payout.id])
        : undefined;
      await approvePayoutRequest(payout.id, amount);
      setNotice(payout.method === 'Safaricom M-Pesa'
        ? 'Payout submitted to Safaricom. It will remain processing until Safaricom confirms the result.'
        : 'Manual payout marked completed.');
      await refresh();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Unable to approve this payout.');
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Finance operations</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Payout review</h1>
          <p className="mt-1 text-sm text-slate-600">Review tester withdrawals and authorize M-Pesa B2C transfers.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Verify the recipient and KES amount before authorizing. A Safaricom request with an ambiguous response stays processing for reconciliation; do not resend it until you verify the result in Safaricom.</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading payout requests…</div>
      ) : payouts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Wallet className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800">No payout requests need review</p>
          <p className="mt-1 text-sm text-slate-500">New tester requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <article key={payout.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-950">{payout.tester?.name || 'Tester'}</h2>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-800">Pending review</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{payout.method}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{payout.tester?.email || 'No profile email'}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">{payout.transaction_ref} · {new Date(payout.requested_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-950">${Number(payout.amount).toFixed(2)} USD</p>
                  <p className="mt-1 text-xs text-slate-600">Recipient: <span className="font-semibold">{payout.destination_account}</span></p>
                </div>
              </div>

              {payout.method === 'Safaricom M-Pesa' && (
                <div className="mt-4 grid gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label htmlFor={`kes-amount-${payout.id}`} className="mb-1 block text-xs font-bold text-emerald-950">Confirm payout amount (KES)</label>
                    <input
                      id={`kes-amount-${payout.id}`}
                      type="number"
                      min="1"
                      step="1"
                      value={approvedAmounts[payout.id] || ''}
                      onChange={(event) => setApprovedAmounts((current) => ({ ...current, [payout.id]: event.target.value }))}
                      className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                    <p className="mt-1 text-[11px] text-emerald-900">
                      Indicative: KES {Number(payout.kes_amount || 0).toLocaleString()} at {Number(payout.exchange_rate || 0).toFixed(4)} KES/USD
                      {payout.exchange_rate_source ? ` · ${payout.exchange_rate_source}` : ''}
                    </p>
                    {payout.exchange_rate_at && <p className="mt-1 text-[10px] text-emerald-800">Rate timestamp: {new Date(payout.exchange_rate_at).toLocaleString()}</p>}
                  </div>
                  <p className="max-w-xs text-[11px] leading-5 text-emerald-950">The approved amount is the amount submitted to Safaricom and may differ from the indicative quote.</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Clock className="h-3.5 w-3.5" /> Funds are reserved while a request is pending or processing.</p>
                <button
                  type="button"
                  onClick={() => void approve(payout)}
                  disabled={busyId === payout.id || (payout.method === 'Safaricom M-Pesa' && (!Number.isInteger(Number(approvedAmounts[payout.id])) || Number(approvedAmounts[payout.id]) < 1))}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === payout.id ? <Clock className="h-4 w-4 animate-pulse" /> : payout.method === 'Safaricom M-Pesa' ? <Send className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {busyId === payout.id ? 'Processing…' : payout.method === 'Safaricom M-Pesa' ? 'Approve & send via M-Pesa' : 'Confirm manual payment'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
