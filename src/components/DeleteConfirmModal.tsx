import React, { useState } from 'react';
import { TransactionItem } from '../shared/types.ts';
import { formatINR } from '../shared/calculations.ts';

interface DeleteConfirmModalProps {
  transaction: TransactionItem | null;
  onCancel: () => void;
  onConfirm: (id: number) => Promise<void>;
}

export function DeleteConfirmModal({
  transaction,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!transaction) return null;

  const summaryParts = [
    formatINR(transaction.amount),
    transaction.type === 'income'
      ? `Money Received (${transaction.source || 'Family'})`
      : transaction.category,
  ];
  if (transaction.note) {
    summaryParts.push(transaction.note);
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm(transaction.id);
      onCancel();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Delete this transaction?
          </h3>
          <p className="text-sm text-slate-600 mt-2 font-medium">
            {summaryParts.join(' — ')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Your available balance will immediately update.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
