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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PayoutRequest } from '../types';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
      <div className="bg-[#0B132B] border border-[#1E2E4E] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-5 border-b border-[#1E2E4E] bg-[#0B132B] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-2 sm:p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
              <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">Tester Earnings & Payouts</h2>
                <span className="text-[10px] sm:text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Secure Wallet
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Automated bounty crediting and multi-rail payment gateway
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-[#111C33] rounded-xl transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          
          {/* Completed Payout Success Notice */}
          {completedPayout && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-5 space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-300">
                      Payout Successfully Dispatched!
                    </h3>
                    <p className="text-xs text-emerald-400/80">
                      Transaction Ref: <span className="font-mono">{completedPayout.transactionRef}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCompletedPayout(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Amount</span>
                  <span className="font-bold text-white text-sm">${completedPayout.amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Payment Gateway</span>
                  <span className="font-medium text-slate-200">{completedPayout.method}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Recipient</span>
                  <span className="font-medium text-slate-200 truncate block">{completedPayout.destinationAccount}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Transferred
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Balance Cards Bento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Available Balance Card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-[#111C33] to-[#0B132B] border border-[#1E2E4E] relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Available for Payout
                </span>
                <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                ${testerProfile.availableBalance.toFixed(2)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
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

            {/* Pending Escrow */}
            <div className="p-5 rounded-xl bg-[#111C33] border border-[#1E2E4E]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pending Escrow
                </span>
                <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-200 tracking-tight">
                ${testerProfile.pendingEscrow.toFixed(2)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Awaiting client review & sign-off
              </p>
              <div className="mt-4 pt-2 text-[11px] text-amber-400/90 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> 2 bugs in review pipeline
              </div>
            </div>

            {/* Lifetime Earned */}
            <div className="p-5 rounded-xl bg-[#111C33] border border-[#1E2E4E]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Lifetime Earnings
                </span>
                <span className="p-1.5 bg-[#007AFF]/15 text-[#00A3E0] rounded-lg">
                  <FileCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-200 tracking-tight">
                ${testerProfile.lifetimeEarnings.toFixed(2)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {testerProfile.approvedBugsCount} approved bugs in {testerProfile.completedCyclesCount} cycles
              </p>
              <div className="mt-4 pt-2 text-[11px] text-[#00A3E0] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Gold Tier (4.94★ rating)
              </div>
            </div>

          </div>

          {/* Payout Form Drawer/Modal */}
          {showPayoutForm && (
            <div className="bg-[#080D1A] border border-[#00A3E0]/40 rounded-xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-[#1E2E4E]">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-[#00A3E0]" />
                  <h3 className="font-semibold text-white text-sm">Disburse Funds via Secure Payment Rail</h3>
                </div>
                <button
                  onClick={() => setShowPayoutForm(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleInitiatePayout} className="space-y-4">
                {/* Method selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Select Payment Gateway Rail
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'PayPal', label: 'PayPal', icon: '🅿️', fee: 'No fee', speed: 'Instant' },
                      { id: 'Payoneer', label: 'Payoneer', icon: '💳', fee: 'No fee', speed: '1-2 hrs' },
                      { id: 'Wise', label: 'Wise', icon: '🌐', fee: '$0.45', speed: 'Same Day' },
                      { id: 'Direct Bank Wire', label: 'Bank Wire', icon: '🏦', fee: '$1.50', speed: '1-3 days' }
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setPayoutMethod(m.id as any)}
                        className={`p-3 rounded-lg border text-left transition ${
                          payoutMethod === m.id
                            ? 'bg-[#007AFF]/20 border-[#00A3E0] text-white'
                            : 'bg-[#111C33] border-[#1E2E4E] text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="text-lg mb-1">{m.icon}</div>
                        <div className="text-xs font-semibold">{m.label}</div>
                        <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                          <span>{m.speed}</span>
                          <span className="text-emerald-400">{m.fee}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Withdrawal Amount (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="10"
                        max={testerProfile.availableBalance}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#111C33] border border-[#1E2E4E] rounded-lg pl-7 pr-16 py-2 text-sm text-white focus:outline-none focus:border-[#00A3E0]"
                      />
                      <button
                        type="button"
                        onClick={handleMaxClick}
                        className="absolute right-2 top-1.5 px-2 py-1 text-[11px] bg-[#1E2E4E] hover:bg-slate-700 text-[#00A3E0] font-semibold rounded"
                      >
                        MAX
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Available: ${testerProfile.availableBalance.toFixed(2)} (Min $10.00)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {payoutMethod === 'Direct Bank Wire' ? 'IBAN / Account Number' : `${payoutMethod} Email or Account ID`}
                    </label>
                    <input
                      type="text"
                      value={destinationAccount}
                      onChange={(e) => setDestinationAccount(e.target.value)}
                      placeholder={payoutMethod === 'Direct Bank Wire' ? 'US89 3704 0044 0532 0130 00' : 'account@email.com'}
                      className="w-full bg-[#111C33] border border-[#1E2E4E] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00A3E0]"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Protected by 256-bit automated encryption
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPayoutForm(false)}
                    className="px-4 py-2 bg-[#111C33] hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition border border-[#1E2E4E]"
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

          {/* Transaction History Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-white flex items-center space-x-2">
                <span>Payout & Bounty Ledger</span>
                <span className="text-xs text-slate-400 font-normal">
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

            <div className="bg-[#080D1A] border border-[#1E2E4E] rounded-xl overflow-hidden divide-y divide-[#1E2E4E]">
              {walletTransactions.map((tx) => {
                const isCredit = tx.type === 'credit_bounty';
                return (
                  <div
                    key={tx.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#111C33]/50 transition"
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`p-2 rounded-lg mt-0.5 ${
                          isCredit
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        {isCredit ? (
                          <DollarSign className="w-4 h-4" />
                        ) : (
                          <Building2 className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-400">{tx.referenceId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4 pl-11 sm:pl-0">
                      <div className="text-right">
                        <div
                          className={`text-sm font-bold ${
                            isCredit ? 'text-emerald-400' : 'text-slate-200'
                          }`}
                        >
                          {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-emerald-400/90 flex items-center justify-end gap-1">
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1E2E4E] bg-[#0B132B] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted Ledger • Automated Instant Disbursals</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#111C33] hover:bg-slate-700 text-slate-200 rounded-lg transition font-medium border border-[#1E2E4E]"
          >
            Close Wallet
          </button>
        </div>

      </div>
    </div>
  );
};
