import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { PublicSharedLedgerResponse } from '../shared/types.ts';
import {
  calculateMonthlySummary,
  formatINR,
  getCategoryIcon,
  getCurrentMonthKey,
  groupTransactionsByDate,
  shiftMonthKey,
} from '../shared/calculations.ts';
import {
  exportMonthlyReportPDF,
  exportTransactionsCSV,
} from '../lib/exportUtils.ts';

interface PublicSharedViewProps {
  token: string;
  onExitPreview?: () => void;
}

export function PublicSharedView({
  token,
  onExitPreview,
}: PublicSharedViewProps) {
  const [data, setData] = useState<PublicSharedLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState<string>(getCurrentMonthKey());

  const fetchSharedLedger = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await fetch(`/api/public/view/${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error ||
              'This shared ledger link is invalid, disabled, or has been regenerated.'
          );
        }
        setData(json);
        setError(null);
      } catch (err: any) {
        setError(
          err.message || 'Unable to load shared ledger. Please check the link.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchSharedLedger(false);
    // Live polling every 12 seconds so changes appear automatically
    const interval = setInterval(() => {
      fetchSharedLedger(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [fetchSharedLedger]);

  // Update page title so parents/WhatsApp tabs clearly show whose money ledger this is
  useEffect(() => {
    if (data?.ownerName) {
      document.title = `${data.ownerName}'s Money — TrackMo`;
    }
    return () => {
      document.title = 'TrackMo — Simple Family Money Ledger';
    };
  }, [data?.ownerName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
          <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-12 w-56 bg-slate-100 rounded animate-pulse" />
          <div className="space-y-3 pt-4">
            <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
            <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <div className="text-lg font-semibold text-slate-900">
            Shared Ledger Unavailable
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {error ||
              'This shared link is no longer active. Please ask the account owner for an updated link.'}
          </p>
          {onExitPreview && (
            <button
              type="button"
              onClick={onExitPreview}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Account
            </button>
          )}
        </div>
      </div>
    );
  }

  const summary = calculateMonthlySummary(
    data.transactions,
    monthKey,
    data.categories
  );
  const groupedDays = groupTransactionsByDate(summary.transactions);
  const currentMonth = getCurrentMonthKey();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onExitPreview && (
              <button
                type="button"
                onClick={onExitPreview}
                className="min-h-[40px] px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}
            <span className="text-base font-bold tracking-tight text-slate-900">
              TrackMo
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Read-only view</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => fetchSharedLedger(true)}
              className="min-h-[36px] px-2 text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 font-medium transition-colors"
              title="Refresh live balance"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Live</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Owner Header & Month Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {data.ownerName}&apos;s Money
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live family ledger · {summary.monthLabel}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
              className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors whitespace-nowrap"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setMonthKey(currentMonth)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                monthKey === currentMonth
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {summary.monthLabel}
            </button>
            <button
              type="button"
              onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
              className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors whitespace-nowrap"
              aria-label="Next Month"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary Available Balance Sheet (5-second comprehension focal anchor) */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Available Balance
            </div>
            <div className="mt-1 text-4xl sm:text-5xl font-bold font-mono-tabular tracking-tight text-slate-900">
              {formatINR(summary.remainingBalance)}
            </div>
            <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <span className="font-mono-tabular font-medium text-emerald-700">
                {formatINR(summary.receivedThisMonth)}
              </span>{' '}
              received this month +{' '}
              <span className="font-mono-tabular font-medium text-slate-800">
                {formatINR(summary.startingBalance)}
              </span>{' '}
              carried forward −{' '}
              <span className="font-mono-tabular font-medium text-slate-800">
                {formatINR(summary.spentThisMonth)}
              </span>{' '}
              spent
            </p>
          </div>

          {/* Clean Ledger Summary Rows */}
          <div className="pt-5 border-t border-slate-100 space-y-2.5 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Starting Balance</span>
              <span className="font-mono-tabular font-medium text-slate-900">
                {formatINR(summary.startingBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Received this month</span>
              <span className="font-mono-tabular font-semibold text-emerald-700">
                {formatINR(summary.receivedThisMonth, true)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Spent</span>
              <span className="font-mono-tabular font-medium text-slate-900">
                {summary.spentThisMonth > 0
                  ? `-${formatINR(summary.spentThisMonth)}`
                  : '₹0'}
              </span>
            </div>
            <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between font-semibold text-slate-900">
              <span>Remaining</span>
              <span className="font-mono-tabular text-base">
                {formatINR(summary.remainingBalance)}
              </span>
            </div>
          </div>
        </section>

        {/* Transaction History */}
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Transactions
            </h2>
            <span className="text-xs text-slate-500 font-mono-tabular">
              {summary.transactions.length}{' '}
              {summary.transactions.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {groupedDays.length === 0 ? (
            <div className="p-10 text-center space-y-1">
              <p className="text-sm font-medium text-slate-700">
                No transactions recorded in {summary.monthLabel}
              </p>
              <p className="text-xs text-slate-500">
                Opening balance carried forward is{' '}
                <span className="font-mono-tabular font-medium text-slate-700">
                  {formatINR(summary.startingBalance)}
                </span>
                .
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groupedDays.map((group) => (
                <div key={group.date}>
                  <div className="px-6 py-2.5 bg-slate-50/70 text-xs font-semibold text-slate-500">
                    {group.label}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {group.items.map((tx) => {
                      const isIncome = tx.type === 'income';
                      const icon = getCategoryIcon(
                        tx.category,
                        data.categories,
                        tx.type
                      );
                      return (
                        <div
                          key={tx.id}
                          className="px-6 py-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-lg shrink-0">
                              {icon}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {isIncome
                                  ? tx.source
                                    ? `${tx.source} — Money Received`
                                    : 'Money Received'
                                  : tx.category}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mt-0.5">
                                {tx.note && (
                                  <span className="text-slate-600 truncate">
                                    {tx.note}
                                  </span>
                                )}
                                {tx.note && tx.paymentMethod && (
                                  <span aria-hidden="true">·</span>
                                )}
                                {tx.paymentMethod && (
                                  <span>{tx.paymentMethod}</span>
                                )}
                                {!tx.note && !tx.paymentMethod && (
                                  <span>
                                    {isIncome ? 'Monthly allowance' : 'Expense'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`text-sm font-semibold font-mono-tabular whitespace-nowrap shrink-0 ${
                              isIncome ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {isIncome
                              ? formatINR(tx.amount, true)
                              : `-${formatINR(tx.amount)}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Compact Spending Breakdown */}
        {summary.categoryBreakdown.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Spending Breakdown
              </h2>
              <span className="text-xs text-slate-500 font-mono-tabular">
                Total: {formatINR(summary.spentThisMonth)}
              </span>
            </div>

            <div className="space-y-3">
              {summary.categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span>{item.category}</span>
                    </span>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {formatINR(item.amount)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 rounded-full"
                      style={{ width: `${Math.max(item.percentage, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Export Actions for Viewer */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Export {summary.monthLabel} Statement
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Download a clean monthly PDF report or CSV spreadsheet.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => exportMonthlyReportPDF(data.ownerName, summary)}
              className="min-h-[40px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={() =>
                exportTransactionsCSV(
                  data.ownerName,
                  summary.monthKey,
                  summary.transactions
                )
              }
              className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-400 pt-2">
          Read-only family view powered by TrackMo · Balances update automatically
        </footer>
      </main>
    </div>
  );
}
