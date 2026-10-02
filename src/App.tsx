/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Home,
  ListOrdered,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldOff,
  Trash2,
  Users,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { PublicSharedView } from './components/PublicSharedView.tsx';
import { TransactionModal } from './components/TransactionModal.tsx';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.tsx';
import { ShareFamilyModal } from './components/ShareFamilyModal.tsx';
import {
  CategoryItem,
  SavedFamilyMember,
  ShareLinkInfo,
  TransactionItem,
  TransactionType,
} from './shared/types.ts';
import {
  calculateMonthlySummary,
  formatINR,
  getCategoryIcon,
  getCurrentMonthKey,
  groupTransactionsByDate,
  shiftMonthKey,
} from './shared/calculations.ts';
import {
  exportMonthlyReportPDF,
  exportTransactionsCSV,
} from './lib/exportUtils.ts';

type ActiveTab = 'home' | 'transactions' | 'reports' | 'settings';

function extractInitialViewToken(): string | null {
  if (typeof window === 'undefined') return null;
  const pathMatch = window.location.pathname.match(/^\/view\/([a-zA-Z0-9_-]+)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get('view');
  if (queryToken && queryToken.trim().length >= 6) {
    return queryToken.trim();
  }
  return null;
}

function MainApplication() {
  const { user, loading: authLoading, logout, authFetch, updateProfileName } =
    useAuth();

  // Route handling for /view/:token (Read-only Family Viewer)
  const [viewToken, setViewToken] = useState<string | null>(
    extractInitialViewToken
  );

  useEffect(() => {
    const handlePopState = () => {
      setViewToken(extractInitialViewToken());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToSharedToken = useCallback((token: string) => {
    const clean = token.trim();
    window.history.pushState({}, '', `/view/${clean}`);
    setViewToken(clean);
  }, []);

  const exitSharedPreview = useCallback(() => {
    window.history.pushState({}, '', '/');
    setViewToken(null);
  }, []);

  // Main Ledger State
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [monthKey, setMonthKey] = useState<string>(getCurrentMonthKey());
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [shareLink, setShareLink] = useState<ShareLinkInfo | null>(null);
  const [savedFamilyLinks, setSavedFamilyLinks] = useState<SavedFamilyMember[]>(
    []
  );
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Modals State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalInitialType, setTxModalInitialType] =
    useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [deletingTx, setDeletingTx] = useState<TransactionItem | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Transactions Tab Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>(
    'all'
  );

  // Settings Tab State
  const [profileNameInput, setProfileNameInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('☕');
  const [familyLinkInput, setFamilyLinkInput] = useState('');
  const [familyLabelInput, setFamilyLabelInput] = useState('');
  const [familyLinkError, setFamilyLinkError] = useState<string | null>(null);
  const [addingFamilyLink, setAddingFamilyLink] = useState(false);
  const [copiedSettingsLink, setCopiedSettingsLink] = useState(false);

  const fetchLedger = useCallback(async () => {
    if (!user) return;
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const res = await authFetch('/api/ledger');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not load your ledger.');
      }
      setTransactions(data.transactions || []);
      setCategories(data.categories || []);
      setShareLink(data.shareLink || null);
      setSavedFamilyLinks(data.savedFamilyLinks || []);
    } catch (err: any) {
      setLedgerError(err.message || 'Failed to load ledger data.');
    } finally {
      setLedgerLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (user) {
      setProfileNameInput(user.name);
      fetchLedger();
    } else {
      setTransactions([]);
      setCategories([]);
      setShareLink(null);
      setSavedFamilyLinks([]);
    }
  }, [user, fetchLedger]);

  // Calculate Monthly Summary & Carry-Forward
  const summary = useMemo(
    () => calculateMonthlySummary(transactions, monthKey, categories),
    [transactions, monthKey, categories]
  );

  // Filtered Transactions for the Transactions tab
  const filteredMonthTransactions = useMemo(() => {
    return summary.transactions.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        tx.category.toLowerCase().includes(q) ||
        (tx.note && tx.note.toLowerCase().includes(q)) ||
        (tx.source && tx.source.toLowerCase().includes(q)) ||
        (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(q))
      );
    });
  }, [summary.transactions, typeFilter, searchQuery]);

  // Handlers for CRUD operations (with immediate state updates)
  const handleSaveTransaction = async (payload: {
    id?: number;
    type: TransactionType;
    amount: number;
    category: string;
    source: string | null;
    note: string | null;
    date: string;
    paymentMethod: string | null;
  }) => {
    if (payload.id) {
      const res = await authFetch(`/api/transactions/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update transaction.');
      }
      setTransactions((prev) =>
        prev.map((item) => (item.id === payload.id ? data.transaction : item))
      );
    } else {
      const res = await authFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add transaction.');
      }
      setTransactions((prev) => [data.transaction, ...prev]);
      // Ensure month view switches to the transaction's month so user sees it immediately
      const txMonth = data.transaction.date.slice(0, 7);
      if (txMonth !== monthKey) {
        setMonthKey(txMonth);
      }
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    const res = await authFetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete transaction.');
    }
    setTransactions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCreateCategory = async (
    name: string,
    icon: string
  ): Promise<CategoryItem> => {
    const res = await authFetch('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, icon }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add category.');
    }
    setCategories((prev) => [...prev, data.category]);
    return data.category;
  };

  const handleDeleteCategory = async (categoryId: number) => {
    const res = await authFetch(`/api/categories/${categoryId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    }
  };

  const handleEnableShare = async () => {
    const res = await authFetch('/api/share/enable', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not enable sharing.');
    setShareLink(data.shareLink);
  };

  const handleDisableShare = async () => {
    const res = await authFetch('/api/share/disable', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not disable sharing.');
    setShareLink(data.shareLink);
  };

  const handleRegenerateShare = async () => {
    const res = await authFetch('/api/share/regenerate', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not regenerate link.');
    setShareLink(data.shareLink);
  };

  const handleAddFamilyMemberLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyLinkInput.trim()) return;
    setAddingFamilyLink(true);
    setFamilyLinkError(null);
    try {
      const res = await authFetch('/api/family-links', {
        method: 'POST',
        body: JSON.stringify({
          linkOrToken: familyLinkInput.trim(),
          label: familyLabelInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not save family link.');
      }
      setSavedFamilyLinks((prev) => [data.familyMember, ...prev]);
      setFamilyLinkInput('');
      setFamilyLabelInput('');
    } catch (err: any) {
      setFamilyLinkError(err.message || 'Invalid family link.');
    } finally {
      setAddingFamilyLink(false);
    }
  };

  const handleRemoveFamilyMemberLink = async (id: number) => {
    const res = await authFetch(`/api/family-links/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setSavedFamilyLinks((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const openAddMoney = () => {
    setEditingTx(null);
    setTxModalInitialType('income');
    setTxModalOpen(true);
  };

  const openAddExpense = () => {
    setEditingTx(null);
    setTxModalInitialType('expense');
    setTxModalOpen(true);
  };

  const openEditTx = (tx: TransactionItem) => {
    setEditingTx(tx);
    setTxModalInitialType(tx.type);
    setTxModalOpen(true);
  };

  // 1. If viewing a public shared link (/view/:token), render PublicSharedView directly without requiring login!
  if (viewToken) {
    return (
      <PublicSharedView
        token={viewToken}
        onExitPreview={user ? exitSharedPreview : exitSharedPreview}
      />
    );
  }

  // 2. While checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 space-y-4">
          <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-12 w-full bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-24 w-full bg-slate-50 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  // 3. If not authenticated, show AuthScreen
  if (!user) {
    return <AuthScreen onOpenSharedToken={navigateToSharedToken} />;
  }

  const currentMonth = getCurrentMonthKey();
  const groupedHomeDays = groupTransactionsByDate(summary.transactions);
  const groupedFilteredDays = groupTransactionsByDate(filteredMonthTransactions);
  const fullShareUrl =
    shareLink && typeof window !== 'undefined'
      ? `${window.location.origin}/view/${shareLink.token}`
      : '';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Top Bar following strict 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 h-14 px-4 sm:px-6 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('home');
          }}
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          TrackMo
        </a>

        {/* Zone 2: 4 clean text navigation links on desktop */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'home'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Transactions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'reports'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'settings'
                ? 'text-slate-900 font-semibold underline underline-offset-8 decoration-2 decoration-slate-900'
                : 'hover:text-slate-900'
            }`}
          >
            Settings
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share with Family</span>
          </button>
          <button
            type="button"
            onClick={openAddExpense}
            className="hidden sm:inline-flex min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg items-center gap-1 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-6 pb-28 md:pb-16 space-y-6">
        {ledgerError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-red-700">
              {ledgerError}
            </span>
            <button
              type="button"
              onClick={fetchLedger}
              className="px-3 py-1.5 text-xs font-semibold bg-white text-red-700 border border-red-200 rounded-lg hover:bg-red-100 whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        {/* Month Navigation Bar (Shown on Home, Transactions, and Reports) */}
        {activeTab !== 'settings' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {summary.monthLabel}
              </h1>
              <p className="text-xs text-slate-500">
                {user.name}&apos;s Family Money Ledger
              </p>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))}
                className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous Month</span>
              </button>

              <button
                type="button"
                onClick={() => setMonthKey(currentMonth)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  monthKey === currentMonth
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                Current Month
              </button>

              <button
                type="button"
                onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))}
                className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <span>Next Month</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 1: HOME DASHBOARD
           =================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Primary Available Balance Hero Card */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-slate-500">
                    Available Balance
                  </div>
                  <div className="mt-1 text-4xl sm:text-5xl font-bold font-mono-tabular tracking-tight text-slate-900">
                    {formatINR(summary.remainingBalance)}
                  </div>
                  <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    <span className="font-mono-tabular font-semibold text-emerald-700">
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

                {/* Primary Quick Actions */}
                <div className="grid grid-cols-2 sm:flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={openAddMoney}
                    className="min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Money</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAddExpense}
                    className="min-h-[44px] px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Expense</span>
                  </button>
                </div>
              </div>

              {/* Clean Ledger Summary Table */}
              <div className="pt-5 border-t border-slate-100 space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Starting Balance</span>
                  <span className="font-mono-tabular font-medium text-slate-900">
                    {formatINR(summary.startingBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Money Received</span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    {formatINR(summary.receivedThisMonth, true)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Total Spent</span>
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

            {/* Share with Family Banner */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-900">
                  Share with Family
                </div>
                <p className="text-xs text-slate-500">
                  {shareLink && shareLink.isActive
                    ? 'Your read-only live family link is active. Parents can view your balance anytime.'
                    : 'Create a read-only live link so your parents or brother can check your balance without logging in.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {shareLink && shareLink.isActive && (
                  <button
                    type="button"
                    onClick={() => navigateToSharedToken(shareLink.token)}
                    className="min-h-[40px] px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Live View</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {shareLink && shareLink.isActive
                      ? 'Copy / Manage Link'
                      : 'Create Live Link'}
                  </span>
                </button>
              </div>
            </section>

            {/* Transaction History List */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Transactions · {summary.monthLabel}
                </h2>
                {summary.transactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('transactions')}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Search &amp; Filter
                  </button>
                )}
              </div>

              {ledgerLoading && transactions.length === 0 ? (
                <div className="p-8 space-y-3">
                  <div className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                  <div className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                </div>
              ) : transactions.length === 0 ? (
                /* Empty state for a brand new account (Section 25) */
                <div className="p-10 text-center space-y-3">
                  <div className="text-base font-semibold text-slate-900">
                    Your money tracker is empty.
                  </div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                    Add the money you received this month to get started.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={openAddMoney}
                      className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Money</span>
                    </button>
                  </div>
                </div>
              ) : groupedHomeDays.length === 0 ? (
                /* Empty state when month has no transactions yet */
                <div className="p-10 text-center space-y-3">
                  <div className="text-base font-semibold text-slate-900">
                    No transactions in {summary.monthLabel} yet.
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Opening balance carried forward is{' '}
                    <span className="font-mono-tabular font-semibold text-slate-700">
                      {formatINR(summary.startingBalance)}
                    </span>
                    . Add money received or log an expense for this month.
                  </p>
                  <div className="pt-1 flex items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={openAddMoney}
                      className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Money</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAddExpense}
                      className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Expense</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {summary.spentThisMonth === 0 &&
                    summary.receivedThisMonth > 0 && (
                      <div className="px-6 py-3 bg-slate-50/60 flex items-center justify-between">
                        <span className="text-xs text-slate-600">
                          No expenses yet. Your spending will appear here once
                          you add a transaction.
                        </span>
                        <button
                          type="button"
                          onClick={openAddExpense}
                          className="text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap ml-3"
                        >
                          + Add Expense
                        </button>
                      </div>
                    )}

                  {groupedHomeDays.map((group) => (
                    <div key={group.date}>
                      <div className="px-6 py-2.5 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        {group.label}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.items.map((tx) => {
                          const isIncome = tx.type === 'income';
                          const icon = getCategoryIcon(
                            tx.category,
                            categories,
                            tx.type
                          );
                          return (
                            <div
                              key={tx.id}
                              className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors group"
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
                                        {isIncome
                                          ? 'Monthly allowance'
                                          : 'Expense'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span
                                  className={`text-sm font-semibold font-mono-tabular whitespace-nowrap ${
                                    isIncome
                                      ? 'text-emerald-700'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {isIncome
                                    ? formatINR(tx.amount, true)
                                    : `-${formatINR(tx.amount)}`}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditTx(tx)}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                    title="Edit transaction"
                                    aria-label="Edit transaction"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTx(tx)}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Delete transaction"
                                    aria-label="Delete transaction"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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

            {/* Compact Category Breakdown on Dashboard (Section 8) */}
            {summary.categoryBreakdown.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">
                    Spending Breakdown
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Full Report →
                  </button>
                </div>

                <div className="space-y-3">
                  {summary.categoryBreakdown.map((cat) => (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800 flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.category}</span>
                        </span>
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          {formatINR(cat.amount)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-800 rounded-full"
                          style={{ width: `${Math.max(cat.percentage, 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Optional Family Dashboard (Section 12) */}
            {savedFamilyLinks.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-600" />
                    <h2 className="text-base font-semibold text-slate-900">
                      Family Ledgers
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900"
                  >
                    Manage
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savedFamilyLinks.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      disabled={!member.isActive}
                      onClick={() => navigateToSharedToken(member.token)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50 text-left flex items-center justify-between transition-colors disabled:opacity-50"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{member.label}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {member.isActive
                            ? `Spent ${formatINR(member.spentThisMonth)} this month`
                            : 'Link disabled by owner'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Available</div>
                        <div className="text-base font-bold font-mono-tabular text-slate-900">
                          {member.isActive
                            ? formatINR(member.availableBalance)
                            : '—'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 2: TRANSACTIONS VIEW
           =================================================================== */}
        {activeTab === 'transactions' && (
          <div className="space-y-5">
            {/* Search & Segmented Type Filter */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
                <input
                  type="text"
                  placeholder="Search by note, category, or source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    typeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({summary.transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('income')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    typeFilter === 'income'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Received
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('expense')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    typeFilter === 'expense'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expenses
                </button>
              </div>
            </div>

            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  {summary.monthLabel} Ledger
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openAddMoney}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    + Add Money
                  </button>
                  <button
                    type="button"
                    onClick={openAddExpense}
                    className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    + Add Expense
                  </button>
                </div>
              </div>

              {groupedFilteredDays.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    No matching transactions found.
                  </p>
                  <p className="text-xs text-slate-500">
                    Try clearing your search filter or switching months.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {groupedFilteredDays.map((group) => (
                    <div key={group.date}>
                      <div className="px-6 py-2.5 bg-slate-50/70 text-xs font-semibold text-slate-500">
                        {group.label}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.items.map((tx) => {
                          const isIncome = tx.type === 'income';
                          const icon = getCategoryIcon(
                            tx.category,
                            categories,
                            tx.type
                          );
                          return (
                            <div
                              key={tx.id}
                              className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
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
                                        {isIncome
                                          ? 'Monthly allowance'
                                          : 'Expense'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span
                                  className={`text-sm font-semibold font-mono-tabular whitespace-nowrap ${
                                    isIncome
                                      ? 'text-emerald-700'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {isIncome
                                    ? formatINR(tx.amount, true)
                                    : `-${formatINR(tx.amount)}`}
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditTx(tx)}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                    aria-label="Edit transaction"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingTx(tx)}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    aria-label="Delete transaction"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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
          </div>
        )}

        {/* ===================================================================
            TAB 3: REPORTS VIEW (Section 24 & 13)
           =================================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Monthly Summary Grid */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Monthly Summary · {summary.monthLabel}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {summary.transactions.length}{' '}
                    {summary.transactions.length === 1
                      ? 'transaction'
                      : 'transactions'}{' '}
                    recorded in {summary.monthLabel}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportMonthlyReportPDF(user.name, summary)}
                    className="min-h-[40px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportTransactionsCSV(
                        user.name,
                        summary.monthKey,
                        summary.transactions
                      )
                    }
                    className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CSV (Month)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-500">Starting Balance</div>
                  <div className="mt-1 text-lg font-bold font-mono-tabular text-slate-900">
                    {formatINR(summary.startingBalance)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-xs text-emerald-800">Total Received</div>
                  <div className="mt-1 text-lg font-bold font-mono-tabular text-emerald-700">
                    {formatINR(summary.receivedThisMonth, true)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs text-slate-500">Total Spent</div>
                  <div className="mt-1 text-lg font-bold font-mono-tabular text-slate-900">
                    {summary.spentThisMonth > 0
                      ? `-${formatINR(summary.spentThisMonth)}`
                      : '₹0'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white">
                  <div className="text-xs text-slate-300">Remaining</div>
                  <div className="mt-1 text-lg font-bold font-mono-tabular">
                    {formatINR(summary.remainingBalance)}
                  </div>
                </div>
              </div>
            </section>

            {/* Category Breakdown */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Category Breakdown
                </h2>
                <span className="text-xs text-slate-500 font-mono-tabular">
                  {summary.categoryBreakdown.length}{' '}
                  {summary.categoryBreakdown.length === 1
                    ? 'category'
                    : 'categories'}
                </span>
              </div>

              {summary.categoryBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No expenses recorded for {summary.monthLabel}.
                </div>
              ) : (
                <div className="space-y-4">
                  {summary.categoryBreakdown.map((cat) => (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5 font-medium text-slate-900">
                          <span className="text-base">{cat.icon}</span>
                          <span>{cat.category}</span>
                          <span className="text-xs text-slate-400 font-normal">
                            · {cat.count} {cat.count === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono-tabular">
                          <span className="text-xs text-slate-500">
                            {cat.percentage}%
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatINR(cat.amount)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full transition-all"
                          style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Export All History Card */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Complete Transaction Archive
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Export all {transactions.length} transactions across all
                  months as a single CSV file.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  exportTransactionsCSV(user.name, 'All_History', transactions)
                }
                className="min-h-[40px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download All Transactions (CSV)</span>
              </button>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 4: SETTINGS VIEW (Section 29)
           =================================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Settings
              </h1>
              <p className="text-xs text-slate-500">
                Manage your profile, family sharing link, custom categories, and
                exports.
              </p>
            </div>

            {/* 1. Profile & Account */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                Profile &amp; Account
              </h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!profileNameInput.trim()) return;
                  setSavingProfile(true);
                  try {
                    await updateProfileName(profileNameInput.trim());
                    setProfileSavedToast(true);
                    setTimeout(() => setProfileSavedToast(false), 2500);
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Display Name (shown on shared family ledger)
                  </label>
                  <input
                    type="text"
                    required
                    value={profileNameInput}
                    onChange={(e) => setProfileNameInput(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.email}
                    className="w-full px-3.5 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="min-h-[40px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                  {profileSavedToast && (
                    <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Profile updated
                    </span>
                  )}
                </div>
              </form>
            </section>

            {/* 2. Family Sharing Controls (Section 29) */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Family Sharing
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Control read-only live access to your money ledger.
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    shareLink?.isActive ? 'text-emerald-700' : 'text-slate-500'
                  }`}
                >
                  Status: {shareLink?.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              {shareLink && shareLink.isActive ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono-tabular text-xs text-slate-700 break-all">
                    {fullShareUrl}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(fullShareUrl);
                        setCopiedSettingsLink(true);
                        setTimeout(() => setCopiedSettingsLink(false), 2000);
                      }}
                      className="min-h-[40px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      {copiedSettingsLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToSharedToken(shareLink.token)}
                      className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRegenerateShare}
                      className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDisableShare}
                      className="min-h-[40px] px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      <span>Disable Sharing</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableShare}
                  className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>
                    {shareLink ? 'Enable Sharing' : 'Create Live Link'}
                  </span>
                </button>
              )}
            </section>

            {/* 3. Saved Family Links (Optional Family Dashboard - Section 12) */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Saved Family Ledgers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Save shared links from your brother, sister, or children to
                  quickly view their balances on your dashboard.
                </p>
              </div>

              {familyLinkError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {familyLinkError}
                </div>
              )}

              <form
                onSubmit={handleAddFamilyMemberLink}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
              >
                <input
                  type="text"
                  placeholder="Label (e.g. Brother)"
                  value={familyLabelInput}
                  onChange={(e) => setFamilyLabelInput(e.target.value)}
                  className="sm:col-span-4 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                />
                <input
                  type="text"
                  required
                  placeholder="Paste shared link (/view/abc123...) or token"
                  value={familyLinkInput}
                  onChange={(e) => setFamilyLinkInput(e.target.value)}
                  className="sm:col-span-6 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                />
                <button
                  type="submit"
                  disabled={addingFamilyLink}
                  className="sm:col-span-2 min-h-[38px] px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {addingFamilyLink ? 'Adding...' : 'Save Link'}
                </button>
              </form>

              {savedFamilyLinks.length > 0 && (
                <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                  {savedFamilyLinks.map((item) => (
                    <div
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {item.label}
                        </div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          {item.isActive
                            ? `Available: ${formatINR(item.availableBalance)}`
                            : 'Link currently inactive'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isActive && (
                          <button
                            type="button"
                            onClick={() => navigateToSharedToken(item.token)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Open Ledger
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFamilyMemberLink(item.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                          aria-label="Remove family link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 4. Categories Management */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Expense Categories
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Default categories and your custom categories.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCatName.trim()) return;
                  await handleCreateCategory(newCatName.trim(), newCatIcon);
                  setNewCatName('');
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  maxLength={4}
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="w-12 px-2 py-2 text-center text-base bg-slate-50 border border-slate-200 rounded-xl"
                  title="Category Emoji Icon"
                />
                <input
                  type="text"
                  placeholder="New custom category name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                />
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  Add Category
                </button>
              </form>

              <div className="flex flex-wrap gap-2 pt-1">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2"
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    {cat.userId !== null && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-slate-400 hover:text-red-600 ml-1"
                        title="Remove custom category"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* 5. Export Data */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Export Records
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download your monthly statement or full transaction history.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => exportMonthlyReportPDF(user.name, summary)}
                  className="min-h-[40px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF ({summary.monthLabel})</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportTransactionsCSV(
                      user.name,
                      summary.monthKey,
                      summary.transactions
                    )
                  }
                  className="min-h-[40px] px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV ({summary.monthLabel})</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportTransactionsCSV(user.name, 'All_Months', transactions)
                  }
                  className="min-h-[40px] px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV (All Transactions)</span>
                </button>
              </div>
            </section>

            {/* 6. Logout */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Sign out of TrackMo
                </div>
                <div className="text-xs text-slate-500">
                  Signed in as {user.email}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="min-h-[42px] px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Floating Action Button (Add Expense) */}
      <button
        type="button"
        onClick={openAddExpense}
        className="md:hidden fixed right-4 bottom-20 z-30 h-12 px-4 rounded-full bg-slate-900 text-white shadow-lg flex items-center gap-1.5 text-xs font-semibold active:scale-95 transition-transform"
        aria-label="Add Expense"
      >
        <Plus className="w-4 h-4" />
        <span>Add Expense</span>
      </button>

      {/* Mobile Bottom Navigation Bar (Section 15) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center h-16">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`min-h-[44px] flex flex-col items-center justify-center ${
            activeTab === 'home' ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">Home</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`min-h-[44px] flex flex-col items-center justify-center ${
            activeTab === 'transactions' ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          <ListOrdered className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">Transactions</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`min-h-[44px] flex flex-col items-center justify-center ${
            activeTab === 'reports' ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">Reports</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`min-h-[44px] flex flex-col items-center justify-center ${
            activeTab === 'settings' ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">Settings</span>
        </button>
      </nav>

      {/* Modals */}
      <TransactionModal
        isOpen={txModalOpen}
        initialType={txModalInitialType}
        editingTransaction={editingTx}
        categories={categories}
        defaultMonthKey={monthKey}
        onClose={() => setTxModalOpen(false)}
        onSave={handleSaveTransaction}
        onCreateCategory={handleCreateCategory}
      />

      <DeleteConfirmModal
        transaction={deletingTx}
        onCancel={() => setDeletingTx(null)}
        onConfirm={handleDeleteTransaction}
      />

      <ShareFamilyModal
        isOpen={shareModalOpen}
        ownerName={user.name}
        shareLink={shareLink}
        onClose={() => setShareModalOpen(false)}
        onEnable={handleEnableShare}
        onDisable={handleDisableShare}
        onRegenerate={handleRegenerateShare}
        onPreviewToken={navigateToSharedToken}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApplication />
    </AuthProvider>
  );
}
