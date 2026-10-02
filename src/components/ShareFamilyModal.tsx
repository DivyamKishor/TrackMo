import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  RefreshCw,
  Share2,
  ShieldOff,
  X,
} from 'lucide-react';
import { ShareLinkInfo } from '../shared/types.ts';

interface ShareFamilyModalProps {
  isOpen: boolean;
  ownerName: string;
  shareLink: ShareLinkInfo | null;
  onClose: () => void;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  onPreviewToken: (token: string) => void;
}

export function ShareFamilyModal({
  isOpen,
  ownerName,
  shareLink,
  onClose,
  onEnable,
  onDisable,
  onRegenerate,
  onPreviewToken,
}: ShareFamilyModalProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isActive = Boolean(shareLink && shareLink.isActive);
  const fullShareUrl =
    shareLink && typeof window !== 'undefined'
      ? `${window.location.origin}/view/${shareLink.token}`
      : '';

  const handleCopy = async () => {
    if (!fullShareUrl) return;
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Could not copy automatically. Please select and copy the link.');
    }
  };

  const handleNativeShare = async () => {
    if (!fullShareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${ownerName}'s Money Ledger — TrackMo`,
          text: `View ${ownerName}'s live monthly money ledger on TrackMo:`,
          url: fullShareUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopy();
  };

  const handleAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message || 'Action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Share with Family
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Share a read-only live link with your parents or sibling. No login
              required for them to view.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] -mr-2 -mt-1 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {!isActive ? (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-700">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {shareLink
                  ? 'Family sharing is currently disabled'
                  : 'Create your live family link'}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Anyone with the link can see your available balance and
                transactions in real time, but cannot add, edit, or delete
                anything.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAction(onEnable)}
              className="w-full min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {busy
                ? 'Creating link...'
                : shareLink
                  ? 'Enable Sharing Link'
                  : 'Create Live Link'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-900">
                  Your family link is ready
                </span>
                <span className="text-emerald-700 font-medium">
                  Status: Active · Read-only
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-emerald-200/80 font-mono-tabular text-xs text-slate-700 break-all select-all">
                {fullShareUrl}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="min-h-[42px] px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      Copied Link!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="min-h-[42px] px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  Share Link
                </button>
              </div>
            </div>

            {shareLink && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPreviewToken(shareLink.token);
                }}
                className="w-full min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Preview what your family sees
              </button>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction(onRegenerate)}
                className="min-h-[40px] px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate Link
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction(onDisable)}
                className="min-h-[40px] px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <ShieldOff className="w-3.5 h-3.5" />
                Disable Sharing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
