import React, { useState } from 'react';
import {
  X,
  DollarSign,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Building2,
  Send,
  Download,
  AlertCircle,
  FileCheck
  , Globe2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PayoutRequest } from '../types';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaymentMethod = 'PayPal' | 'Payoneer' | 'Direct Bank Wire' | 'Wise';

const PaymentMethodLogo: React.FC<{ method: PaymentMethod; className?: string }> = ({ method, className = 'h-5 w-5' }) => {
  const commonProps = { className, viewBox: '0 0 32 32', fill: 'none' } as const;

  switch (method) {
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
  const { testerProfile, walletTransactions, requestPayout } = useApp();
  
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutMethod, setPayoutMethod] = useState<'PayPal' | 'Payoneer' | 'Direct Bank Wire' | 'Wise'>('PayPal');
  const [destinationAccount, setDestinationAccount] = useState('ezrahbosire1@gmail.com');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedPayout, setCompletedPayout] = useState<PayoutRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

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

    setIsProcessing(true);

    // Simulate secure 2-second gateway authorization
    setTimeout(async () => {
      try {
        const result = await requestPayout(amt, payoutMethod, destinationAccount);
        setIsProcessing(false);
        setCompletedPayout(result);
        setShowPayoutForm(false);
      } catch (err: any) {
        setIsProcessing(false);
        setErrorMessage(err.message || 'Payment gateway connection error.');
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px] p-2 sm:p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-200 shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Tester Earnings & Payouts</h2>
                <span className="text-[10px] sm:text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Secure Wallet
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Automated bounty crediting and multi-rail payment gateway
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 bg-white">
          
          {/* Completed Payout Success Notice */}
          {completedPayout && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-700">
                      Payout Successfully Dispatched!
                    </h3>
                    <p className="text-xs text-emerald-700/80">
                      Transaction Ref: <span className="font-mono">{completedPayout.transactionRef}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCompletedPayout(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Dismiss
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Amount</span>
                  <span className="font-bold text-slate-900 text-sm">${completedPayout.amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Payment Gateway</span>
                  <span className="font-medium text-slate-700">{completedPayout.method}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Recipient</span>
                  <span className="font-medium text-slate-700 truncate block">{completedPayout.destinationAccount}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Status</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> Transferred
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Balance Cards Bento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Available for Payout
                </span>
                <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${testerProfile.availableBalance.toFixed(2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Credited from approved bug reports
              </p>
              <div className="mt-4">
                <button
                  onClick={() => setShowPayoutForm(true)}
                  disabled={testerProfile.availableBalance < 10}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition shadow-sm"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Request Payout</span>
                </button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Pending Escrow
                </span>
                <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
                ${testerProfile.pendingEscrow.toFixed(2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Awaiting client review & sign-off
              </p>
              <div className="mt-4 pt-2 text-[11px] text-amber-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> 2 bugs in review pipeline
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Lifetime Earnings
                </span>
                <span className="p-1.5 bg-blue-100 text-[#00A3E0] rounded-lg">
                  <FileCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-800 tracking-tight">
                ${testerProfile.lifetimeEarnings.toFixed(2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {testerProfile.approvedBugsCount} approved bugs in {testerProfile.completedCyclesCount} cycles
              </p>
              <div className="mt-4 pt-2 text-[11px] text-[#00A3E0] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Gold Tier (4.94 rating)
              </div>
            </div>

          </div>

          {/* Payout Form Drawer/Modal */}
          {showPayoutForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-[#00A3E0]" />
                  <h3 className="font-semibold text-slate-900 text-sm">Disburse Funds via Secure Payment Rail</h3>
                </div>
                <button
                  onClick={() => setShowPayoutForm(false)}
                  className="text-slate-500 hover:text-slate-800 text-xs"
                >
                  Cancel
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleInitiatePayout} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Select Payment Gateway Rail
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'PayPal', label: 'PayPal', icon: CreditCard, fee: 'No fee', speed: 'Instant' },
                      { id: 'Payoneer', label: 'Payoneer', icon: CreditCard, fee: 'No fee', speed: '1-2 hrs' },
                      { id: 'Wise', label: 'Wise', icon: Globe2, fee: '$0.45', speed: 'Same Day' },
                      { id: 'Direct Bank Wire', label: 'Bank Wire', icon: Building2, fee: '$1.50', speed: '1-3 days' }
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setPayoutMethod(m.id as any)}
                        className={`p-3 rounded-lg border text-left transition ${
                          payoutMethod === m.id
                            ? 'bg-[#007AFF]/10 border-[#00A3E0] text-slate-900'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <m.icon className="mb-1 h-5 w-5 text-[#00A3E0]" />
                        <div className="text-xs font-semibold">{m.label}</div>
                        <div className="text-[10px] text-slate-500 flex justify-between mt-1">
                          <span>{m.speed}</span>
                          <span className="text-emerald-600">{m.fee}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Withdrawal Amount (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="10"
                        max={testerProfile.availableBalance}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-16 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#00A3E0]"
                      />
                      <button
                        type="button"
                        onClick={handleMaxClick}
                        className="absolute right-2 top-1.5 px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-[#00A3E0] font-semibold rounded"
                      >
                        MAX
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Available: ${testerProfile.availableBalance.toFixed(2)} (Min $10.00)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {payoutMethod === 'Direct Bank Wire' ? 'IBAN / Account Number' : `${payoutMethod} Email or Account ID`}
                    </label>
                    <input
                      type="text"
                      value={destinationAccount}
                      onChange={(e) => setDestinationAccount(e.target.value)}
                      placeholder={payoutMethod === 'Direct Bank Wire' ? 'US89 3704 0044 0532 0130 00' : 'account@email.com'}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#00A3E0]"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Protected by 256-bit automated encryption
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPayoutForm(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition border border-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-2 transition shadow"
                  >
                    {isProcessing ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Authorizing Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Authorize & Transfer Funds</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-800 flex items-center space-x-2">
                <span>Payout & Bounty Ledger</span>
                <span className="text-xs text-slate-500 font-normal">
                  ({walletTransactions.length} recorded events)
                </span>
              </h3>
              <button
                onClick={() => alert("Ledger downloaded as encrypted CSV format")}
                className="text-xs text-[#00A3E0] hover:text-[#38BDF8] flex items-center space-x-1 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Statement</span>
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
              {walletTransactions.map((tx) => {
                const isCredit = tx.type === 'credit_bounty';
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`p-2 rounded-lg mt-0.5 ${
                          isCredit
                            ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                            : 'bg-violet-100 text-violet-600 border border-violet-200'
                        }`}
                      >
                        {isCredit ? (
                          <DollarSign className="w-4 h-4" />
                        ) : (
                          <Building2 className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">{tx.referenceId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4 pl-11 sm:pl-0">
                      <div className="text-right">
                        <div
                          className={`text-sm font-bold ${
                            isCredit ? 'text-emerald-600' : 'text-slate-700'
                          }`}
                        >
                          {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-emerald-600 flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Cleared
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Ledger • Automated Instant Disbursals</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium border border-slate-200"
          >
            Close Wallet
          </button>
        </div>

      </div>
    </div>
  );
};
