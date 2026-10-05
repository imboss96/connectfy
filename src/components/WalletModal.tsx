import React, { useEffect, useState } from 'react';
import {
  X,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Send,
  Download,
  AlertCircle,
  FileCheck,
  ArrowDownLeft,
  Wallet
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PayoutQuote, PayoutRequest, TesterPaymentSettings, WalletTransaction } from '../types';
import { fetchMpesaPayoutQuote } from '../lib/mpesaPayoutService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentMethod = PayoutRequest['method'];

type LedgerFilter = 'all' | 'credits' | 'withdrawals';

const PAYMENT_METHODS: PaymentMethod[] = ['Safaricom M-Pesa', 'PayPal', 'Payoneer', 'Wise', 'Direct Bank Wire'];

const getSavedDestination = (method: PaymentMethod, settings?: TesterPaymentSettings) => {
  if (!settings) return '';
  switch (method) {
    case 'Safaricom M-Pesa': return '';
    case 'Safaricom M-Pesa': return '';
    case 'PayPal': return settings.paypalEmail;
    case 'Payoneer': return settings.payoneerId;
    case 'Wise': return settings.wiseEmail;
    case 'Direct Bank Wire': return settings.bankDetails?.ibanOrAccount || '';
  }
};

const PaymentMethodLogo: React.FC<{ method: PaymentMethod; className?: string }> = ({ method, className = 'h-5 w-5' }) => {
  const commonProps = { className, viewBox: '0 0 32 32', fill: 'none' } as const;

  switch (method) {
    case 'Safaricom M-Pesa':
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#087F3E" />
          <path d="M8 10h4l4 12h-4L8 10Zm7 0h4l4 12h-4l-4-12Zm7 0h3l-3 9h-3l3-9Z" fill="white" />
        </svg>
      );
    case 'PayPal':
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0F6BFF"/>
          <path d="M10 18.5C10 15.7 12.1 13.5 15.1 13.5H18.5C21.8 13.5 24.1 15.8 24.1 19.1C24.1 22.5 21.7 25 18.2 25H14.4C13.1 25 12 24 12 22.7L10.7 16.9C10.5 15.9 10.9 15.1 11.7 15.1H15.4C17.8 15.1 19.2 16.3 19.2 18.4C19.2 20.4 17.7 21.6 15.5 21.6H13.7L13.1 18.5H10Z" fill="white"/>
          <path d="M12.9 11.3L13.7 8.8C14 7.9 14.7 7.3 15.8 7.3H19.1C20.8 7.3 22.1 8.4 22.1 10.2C22.1 11.8 21 12.8 19.2 12.8H17.2L16.5 11.3H12.9Z" fill="#A7D1FF"/>
        </svg>
      );
    case 'Wise':
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#1F5CFF"/>
          <path d="M9 10.5H18.3C21.2 10.5 23.5 12.8 23.5 15.8C23.5 18.7 21.2 21 18.3 21H13.7L15.8 18.2H18.2C19.6 18.2 20.7 17.1 20.7 15.7C20.7 14.3 19.6 13.2 18.2 13.2H11.8L9 10.5Z" fill="white"/>
          <path d="M10.8 15.9H12.9L9.8 21H7.6L10.8 15.9ZM13.3 9.5H15.9L12.8 14.7H10.2L13.3 9.5Z" fill="#DDEBFF"/>
        </svg>
      );
    case 'Payoneer':
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#121C2D"/>
          <path d="M10 23.2V8.8H16.2C19.7 8.8 22 10.8 22 14.2C22 17.7 19.8 19.7 16.1 19.7H14.5V23.2H10ZM14.5 16.3H15.8C17.4 16.3 18.1 15.7 18.1 14.3C18.1 12.8 17.4 12.2 15.8 12.2H14.5V16.3Z" fill="#D7F3FF"/>
          <path d="M18.5 8.8H22V23.2H18.5V8.8Z" fill="#7CD8FF"/>
        </svg>
      );
    case 'Direct Bank Wire':
    default:
      return (
        <svg {...commonProps}>
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#0F766E"/>
          <path d="M9 11.5C9 10.1 10.1 9 11.5 9H20.5C21.9 9 23 10.1 23 11.5V20.5C23 21.9 21.9 23 20.5 23H11.5C10.1 23 9 21.9 9 20.5V11.5Z" fill="white" fillOpacity="0.12"/>
          <path d="M11 12.5H21M11 16H21M11 19.5H17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M13.5 9V6.5M18.5 9V6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );
  }
};

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { testerProfile, walletTransactions, requestPayout, bugReports, taskSubmissions } = useApp();
  
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutMethod, setPayoutMethod] = useState<PaymentMethod>(() => testerProfile.paymentSettings?.preferredMethod || 'PayPal');
  const [destinationAccount, setDestinationAccount] = useState(() =>
    payoutMethod === 'Safaricom M-Pesa'
      ? testerProfile.phone || ''
      : getSavedDestination(payoutMethod, testerProfile.paymentSettings)
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedPayout, setCompletedPayout] = useState<PayoutRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [mpesaQuote, setMpesaQuote] = useState<PayoutQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  useEffect(() => {
    if (!isOpen || payoutMethod !== 'Safaricom M-Pesa' || !Number.isFinite(Number(payoutAmount)) || Number(payoutAmount) <= 0) {
      setMpesaQuote(null);
      setQuoteError('');
      setIsLoadingQuote(false);
      return;
    }

    let isCurrent = true;
    const timeoutId = window.setTimeout(() => {
      setIsLoadingQuote(true);
      setQuoteError('');
      void fetchMpesaPayoutQuote(Number(payoutAmount))
        .then((quote) => {
          if (isCurrent) setMpesaQuote(quote);
        })
        .catch((error) => {
          if (isCurrent) {
            setMpesaQuote(null);
            setQuoteError(error instanceof Error ? error.message : 'Unable to quote USD to KES.');
          }
        })
        .finally(() => {
          if (isCurrent) setIsLoadingQuote(false);
        });
    }, 350);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, payoutAmount, payoutMethod]);

  const pendingReviewCount =
    bugReports.filter((report) => report.testerId === testerProfile.id && (report.status === 'submitted' || report.status === 'under_review')).length +
    taskSubmissions.filter((submission) => submission.testerId === testerProfile.id && (submission.status === 'submitted' || submission.status === 'under_review')).length;
  const visibleTransactions = walletTransactions.filter((transaction) =>
    ledgerFilter === 'all' ||
    (ledgerFilter === 'credits' && transaction.type === 'credit_bounty') ||
    (ledgerFilter === 'withdrawals' && transaction.type === 'payout_withdrawal')
  );

  if (!isOpen) return null;

  const handleMaxClick = () => {
    setPayoutAmount(testerProfile.availableBalance.toString());
  };

  const handleInitiatePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const amt = parseFloat(payoutAmount);

    if (isNaN(amt) || amt <= 0) {
      setErrorMessage('Please enter a valid payout amount.');
      return;
    }
    if (amt > testerProfile.availableBalance) {
      setErrorMessage('Requested amount exceeds your available balance.');
      return;
    }
    if (amt < 10) {
      setErrorMessage('Minimum payout withdrawal is $10.00.');
      return;
    }
    if (!destinationAccount.trim()) {
      setErrorMessage('Please enter your recipient account / email.');
      return;
    }
    if (payoutMethod === 'Safaricom M-Pesa' && !mpesaQuote) {
      setErrorMessage(quoteError || 'Wait for a current USD to KES quote before submitting.');
      return;
    }

    setIsProcessing(true);

    setIsProcessing(true);
    try {
      const result = await requestPayout(amt, payoutMethod, destinationAccount.trim());
      setCompletedPayout(result);
      setShowPayoutForm(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to request this withdrawal.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportStatement = () => {
    const rows = [
      ['Date', 'Description', 'Type', 'Amount (USD)', 'Status', 'Reference'],
      ...visibleTransactions.map((transaction: WalletTransaction) => [
        transaction.date,
        transaction.description,
        transaction.type === 'credit_bounty' ? 'Slot payout' : 'Withdrawal',
        `${transaction.type === 'credit_bounty' ? '' : '-'}${transaction.amount.toFixed(2)}`,
        transaction.status,
        transaction.referenceId
      ])
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const fileUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = 'connectfy-wallet-statement.csv';
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-sm sm:p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Tester wallet</p>
              <h2 id="wallet-modal-title" className="truncate text-base font-bold text-slate-950 sm:text-lg">Slot payouts</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close wallet"
            className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          {/* Completed Payout Success Notice */}
          {completedPayout && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <h3 className="text-sm font-bold text-amber-950">Payout request submitted</h3>
                  <p className="text-xs text-amber-800">${completedPayout.amount.toFixed(2)} via {completedPayout.method} is awaiting admin review · Ref {completedPayout.transactionRef}</p>
                </div>
              </div>
              <button type="button" onClick={() => setCompletedPayout(null)} className="text-xs font-semibold text-emerald-800 underline underline-offset-2">Dismiss</button>
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid lg:grid-cols-[1.1fr_1.9fr]">
              <div className="flex flex-col items-start justify-between gap-5 bg-[#eaf6f2] p-5 sm:p-6">
                <div>
                  <p className="text-xs font-semibold text-emerald-800">Available to withdraw</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-slate-950">${testerProfile.availableBalance.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-slate-600">From approved defect and task work</p>
                </div>
                <button
                  onClick={() => setShowPayoutForm((visible) => !visible)}
                  disabled={testerProfile.availableBalance < 10}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {showPayoutForm ? 'Close withdrawal form' : 'Withdraw funds'}
                </button>
              </div>
              <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="flex flex-col justify-center p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Clock className="h-4 w-4 text-amber-600" /> Pending review</div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">${testerProfile.pendingEscrow.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-slate-500">{pendingReviewCount} submission{pendingReviewCount === 1 ? '' : 's'} awaiting review</p>
                </div>
                <div className="flex flex-col justify-center p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><FileCheck className="h-4 w-4 text-sky-700" /> Lifetime slot payouts</div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">${testerProfile.lifetimeEarnings.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-slate-500">{testerProfile.tier} · {testerProfile.rating.toFixed(2)} tester rating</p>
                </div>
              </div>
            </div>
          </section>

          {/* Payout Form Drawer/Modal */}
          {showPayoutForm && (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Withdraw slot payout</h3>
                  <p className="mt-1 text-xs text-slate-500">Minimum withdrawal: $10.00</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowPayoutForm(false); setErrorMessage(''); }}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleInitiatePayout} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700">
                    Withdrawal method
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        type="button"
                        key={method}
                        onClick={() => {
                          setPayoutMethod(method);
                          setDestinationAccount(method === 'Safaricom M-Pesa'
                            ? testerProfile.phone || ''
                            : getSavedDestination(method, testerProfile.paymentSettings));
                        }}
                        aria-pressed={payoutMethod === method}
                        className={`flex min-h-16 items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                          payoutMethod === method
                            ? 'border-emerald-600 bg-emerald-50 text-slate-950 ring-1 ring-emerald-600'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <PaymentMethodLogo method={method} className="h-6 w-6 shrink-0" />
                        <span className="text-xs font-semibold">{method === 'Direct Bank Wire' ? 'Bank wire' : method === 'Safaricom M-Pesa' ? 'M-Pesa' : method}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="wallet-withdrawal-amount" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Amount to withdraw
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm text-slate-500">$</span>
                      <input
                        id="wallet-withdrawal-amount"
                        type="number"
                        step="0.01"
                        min="10"
                        max={testerProfile.availableBalance}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-7 pr-16 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      />
                      <button
                        type="button"
                        onClick={handleMaxClick}
                        className="absolute right-2 top-1.5 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                      >
                        Max
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">Available: ${testerProfile.availableBalance.toFixed(2)}</p>
                  </div>

                  <div>
                    <label htmlFor="wallet-destination-account" className="mb-1.5 block text-xs font-semibold text-slate-700">
                      {payoutMethod === 'Safaricom M-Pesa' ? 'Safaricom M-Pesa phone' : payoutMethod === 'Direct Bank Wire' ? 'Bank account / IBAN' : `${payoutMethod} recipient`}
                    </label>
                    <input
                      id="wallet-destination-account"
                      type="text"
                      value={destinationAccount}
                      onChange={(e) => setDestinationAccount(e.target.value)}
                      placeholder={payoutMethod === 'Safaricom M-Pesa' ? '0712345678 or +254712345678' : payoutMethod === 'Direct Bank Wire' ? 'Enter account number or IBAN' : 'Enter email or account ID'}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                    <p className="mt-1.5 text-[11px] text-slate-500">{payoutMethod === 'Safaricom M-Pesa' ? 'Only Kenyan Safaricom mobile numbers are supported.' : 'Defaults to the payment detail saved in Profile & Fleet.'}</p>
                  </div>
                </div>

                {payoutMethod === 'Safaricom M-Pesa' && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-950">
                    {isLoadingQuote ? (
                      <p>Loading live USD/KES quote…</p>
                    ) : mpesaQuote ? (
                      <>
                        <p className="font-semibold">${mpesaQuote.usdAmount.toFixed(2)} ≈ KES {mpesaQuote.kesAmount.toLocaleString()}</p>
                        <p className="mt-1">Rate: 1 USD = {mpesaQuote.exchangeRate.toFixed(4)} KES · Quote source: {mpesaQuote.source}</p>
                        <p className="mt-1">The final KES amount is subject to admin review before Safaricom submission.</p>
                      </>
                    ) : (
                      <p className="text-rose-700">{quoteError || 'Enter a USD amount to see the current indicative KES quote.'}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] text-slate-500">Minimum withdrawal is $10.00.</p>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isProcessing ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Submitting request…</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Submit payout request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-950">Activity</h3>
                <p className="mt-0.5 text-xs text-slate-500">Slot payout credits and withdrawal requests</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1" aria-label="Filter wallet activity">
                  {([{ id: 'all', label: 'All' }, { id: 'credits', label: 'Payouts' }, { id: 'withdrawals', label: 'Withdrawals' }] as const).map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setLedgerFilter(filter.id)}
                      aria-pressed={ledgerFilter === filter.id}
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${ledgerFilter === filter.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleExportStatement}
                  disabled={visibleTransactions.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
              {visibleTransactions.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Wallet className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold text-slate-800">No wallet activity yet</p>
                  <p className="mt-1 text-xs text-slate-500">Approved slot payouts and withdrawals will appear here.</p>
                </div>
              ) : visibleTransactions.map((tx) => {
                const isCredit = tx.type === 'credit_bounty';
                const statusStyle = tx.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-800'
                  : tx.status === 'failed'
                    ? 'bg-rose-50 text-rose-800'
                  : tx.status === 'processing'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-slate-100 text-slate-700';
                return (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-6"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`p-2 rounded-lg mt-0.5 ${
                          isCredit
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900">
                          {tx.description}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{tx.referenceId}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`col-start-2 row-start-1 rounded-full px-2 py-1 text-[10px] font-bold capitalize ${statusStyle} sm:col-start-auto sm:row-start-auto`}>
                      {tx.status}
                    </span>
                    <div className={`col-span-2 text-right text-sm font-bold sm:col-span-1 ${isCredit ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <p className="text-[11px] text-slate-500">Payouts require admin review before transfer.</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Minimum withdrawal $10</span>
            <span aria-hidden="true">·</span>
            <span>USD</span>
          </div>
        </div>

      </div>
    </div>
  );
};
