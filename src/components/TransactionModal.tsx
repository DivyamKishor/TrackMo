import React, { useEffect, useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import {
  CategoryItem,
  TransactionItem,
  TransactionType,
} from '../shared/types.ts';
import {
  COMMON_SOURCES,
  DEFAULT_CATEGORIES,
  getTodayDateString,
  PAYMENT_METHODS,
} from '../shared/calculations.ts';

interface TransactionModalProps {
  isOpen: boolean;
  initialType: TransactionType;
  editingTransaction: TransactionItem | null;
  categories: CategoryItem[];
  defaultMonthKey?: string;
  onClose: () => void;
  onSave: (payload: {
    id?: number;
    type: TransactionType;
    amount: number;
    category: string;
    source: string | null;
    note: string | null;
    date: string;
    paymentMethod: string | null;
  }) => Promise<void>;
  onCreateCategory?: (name: string, icon: string) => Promise<CategoryItem>;
}

const CUSTOM_EMOJI_OPTIONS = ['☕', '🍕', '🚌', '✈️', '🏋️', '📱', '🎮', '👕', '🧺', '🎓', '🏥', '🏷️'];

export function TransactionModal({
  isOpen,
  initialType,
  editingTransaction,
  categories,
  defaultMonthKey,
  onClose,
  onSave,
  onCreateCategory,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState('Food');
  const [source, setSource] = useState('Dad');
  const [customSource, setCustomSource] = useState('');
  const [isCustomSource, setIsCustomSource] = useState(false);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline custom category state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('☕');
  const [creatingCat, setCreatingCat] = useState(false);

  const mergedCategories: Array<{ name: string; icon: string }> =
    categories.length > 0
      ? categories.map((c) => ({ name: c.name, icon: c.icon }))
      : DEFAULT_CATEGORIES;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setShowNewCategory(false);

    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(String(editingTransaction.amount));
      setCategory(
        editingTransaction.type === 'expense'
          ? editingTransaction.category
          : 'Food'
      );
      const existingSource = editingTransaction.source || 'Dad';
      if (COMMON_SOURCES.includes(existingSource)) {
        setSource(existingSource);
        setIsCustomSource(false);
        setCustomSource('');
      } else {
        setSource('Other');
        setIsCustomSource(true);
        setCustomSource(existingSource);
      }
      setNote(editingTransaction.note || '');
      setDate(editingTransaction.date);
      setPaymentMethod(editingTransaction.paymentMethod || '');
    } else {
      setType(initialType);
      setAmountStr('');
      setCategory('Food');
      setSource('Dad');
      setIsCustomSource(false);
      setCustomSource('');
      setNote('');

      const today = getTodayDateString();
      if (defaultMonthKey && !today.startsWith(defaultMonthKey)) {
        setDate(`${defaultMonthKey}-01`);
      } else {
        setDate(today);
      }
      setPaymentMethod('');
    }
  }, [isOpen, initialType, editingTransaction, defaultMonthKey]);

  if (!isOpen) return null;

  const handleAddCustomCategory = async () => {
    if (!newCatName.trim() || !onCreateCategory) return;
    setCreatingCat(true);
    try {
      const created = await onCreateCategory(newCatName.trim(), newCatIcon);
      setCategory(created.name);
      setNewCatName('');
      setShowNewCategory(false);
    } catch (err: any) {
      setError(err.message || 'Could not add category.');
    } finally {
      setCreatingCat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amountStr);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount greater than ₹0.');
      return;
    }

    const finalSource = isCustomSource
      ? customSource.trim() || 'Family'
      : source || 'Dad';

    if (!date) {
      setError('Please select a date.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        id: editingTransaction?.id,
        type,
        amount: parsedAmount,
        category: type === 'income' ? 'Money Received' : category,
        source: type === 'income' ? finalSource : null,
        note: note.trim() ? note.trim() : null,
        date,
        paymentMethod:
          type === 'expense' && paymentMethod ? paymentMethod : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile grab handle */}
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />

        <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editingTransaction
                ? type === 'income'
                  ? 'Edit Money Received'
                  : 'Edit Expense'
                : type === 'income'
                  ? 'Add Money Received'
                  : 'Add Expense'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {type === 'income'
                ? 'Record allowance or money received from family'
                : 'Record how your money was spent'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher when adding new */}
        {!editingTransaction && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  type === 'expense'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Expense (-₹)
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Money Received (+₹)
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Amount
            </label>
            <div className="relative flex items-center">
              <span
                className={`absolute left-4 text-2xl font-semibold font-mono-tabular select-none ${
                  type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                }`}
              >
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                autoFocus
                placeholder={type === 'income' ? '20000' : '450'}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className={`w-full pl-11 pr-4 py-3.5 text-2xl font-semibold font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900 transition-colors ${
                  type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                }`}
              />
            </div>
          </div>

          {type === 'income' ? (
            /* Source Selector for Money Received */
            <div className="space-y-2.5">
              <label className="block text-xs font-medium text-slate-600">
                Received From (Source)
              </label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SOURCES.map((src) => {
                  const active = !isCustomSource && source === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => {
                        setSource(src);
                        setIsCustomSource(false);
                      }}
                      className={`min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {src}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setIsCustomSource(true)}
                  className={`min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                    isCustomSource
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Custom...
                </button>
              </div>
              {isCustomSource && (
                <input
                  type="text"
                  placeholder="Enter name (e.g. Uncle, Scholarship)"
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900"
                />
              )}
            </div>
          ) : (
            /* Category Selector for Expense */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600">
                  Category
                </label>
                {onCreateCategory && (
                  <button
                    type="button"
                    onClick={() => setShowNewCategory(!showNewCategory)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom
                  </button>
                )}
              </div>

              {showNewCategory && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-medium text-slate-700">
                    New Custom Category
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CUSTOM_EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewCatIcon(emoji)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base border transition-colors ${
                          newCatIcon === emoji
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Category name (e.g. Coffee, Laundry)"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      disabled={creatingCat || !newCatName.trim()}
                      onClick={handleAddCustomCategory}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-0.5">
                {mergedCategories.map((cat) => {
                  const selected = category === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 transition-colors ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-base shrink-0">{cat.icon}</span>
                      <span className="text-xs font-medium truncate">
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Note <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder={
                  type === 'income'
                    ? 'e.g. October allowance'
                    : 'e.g. Lunch with friends'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-900 transition-colors font-mono-tabular"
              />
            </div>
          </div>

          {/* Optional Payment Method for Expenses */}
          {type === 'expense' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Payment Method{' '}
                <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() =>
                        setPaymentMethod(active ? '' : method)
                      }
                      className={`min-h-[40px] py-2 px-3 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit & Cancel Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`min-h-[44px] px-6 py-2.5 text-xs font-semibold text-white rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap ${
                type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {submitting
                ? 'Saving...'
                : editingTransaction
                  ? 'Save Changes'
                  : type === 'income'
                    ? 'Add Money'
                    : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
