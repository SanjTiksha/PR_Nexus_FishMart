import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const variantClasses = {
  success: 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500',
  danger: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
  primary: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
};

/**
 * FishMart Admin confirmation dialog — replaces native confirm()/alert() for Admin Orders.
 */
const AdminConfirmModal = ({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  details = null,
  notice = null,
  noticeVariant = 'info',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onCancel?.();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Focus primary action for keyboard users
    const t = setTimeout(() => confirmRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(t);
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmClass =
    variantClasses[confirmVariant] || variantClasses.primary;

  const noticeClass =
    noticeVariant === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : noticeVariant === 'danger'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-blue-100 bg-blue-50 text-blue-900';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!loading) onCancel?.();
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative z-10 w-[calc(100%-32px)] max-w-[500px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
          <h2
            id={titleId}
            className="text-lg font-bold text-slate-900 leading-snug pr-2"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!loading) onCancel?.();
            }}
            disabled={loading}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p id={descId} className="text-sm text-gray-700 leading-relaxed">
            {message}
          </p>

          {details && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 space-y-1.5 text-sm">
              {details}
            </div>
          )}

          {notice && (
            <div className={`rounded-xl border px-3 py-2.5 text-xs sm:text-sm ${noticeClass}`}>
              {notice}
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-1 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (!loading) onCancel?.();
            }}
            disabled={loading}
            className="min-h-[44px] px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => {
              if (!loading) onConfirm?.();
            }}
            disabled={loading}
            className={`min-h-[44px] px-4 rounded-xl text-white font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-70 ${confirmClass}`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Updating…
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminConfirmModal;
