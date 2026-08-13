import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, RefreshCw, Search, X } from 'lucide-react';
import {
  getCustomerOrders,
  updateCustomerOrderPayment,
  updateCustomerOrderStatus,
} from '../services/firestoreService';
import {
  getOrderFinancialBreakdown,
  formatOrderDiscountLabel,
} from '../utils/orderFinancialDisplay';
import { calculateLineTotal, normalizeQuantity } from '../utils/quantityUtils';
import { getPaymentStatusLabel, openOrderWhatsApp } from '../utils/orderWhatsApp';
import { formatDeliveryPreferenceAdmin, slotEmoji } from '../utils/deliverySlot';
import AdminConfirmModal from './AdminConfirmModal';

const PAYMENT_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending Verification' },
  { id: 'verified', label: 'Payment Verified' },
  { id: 'failed', label: 'Payment Failed' },
];

const ORDER_STATUS_OPTIONS = [
  'Processing',
  'Preparing',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const ORDER_STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  ...ORDER_STATUS_OPTIONS.map((s) => ({ id: s, label: s })),
];

const DATE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
];

const PAYMENT_ACTIONS = [
  { id: 'PENDING_CONFIRMATION', label: 'Payment Pending' },
  { id: 'VERIFIED', label: 'Payment Verified' },
  { id: 'FAILED', label: 'Payment Failed' },
];

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

const getPaymentBucket = (order) => {
  if (order?.paymentStatus === 'FAILED') return 'failed';
  if (order?.paymentStatus === 'VERIFIED' || order?.paidVerified === true) return 'verified';
  return 'pending';
};

const getOrderStatus = (order) => order?.orderStatus || 'Processing';

const paymentBadgeClass = (bucket) => {
  if (bucket === 'verified') return 'bg-green-100 text-green-800';
  if (bucket === 'failed') return 'bg-red-100 text-red-800';
  return 'bg-orange-100 text-orange-800';
};

const orderStatusBadgeClass = (status) => {
  switch (status) {
    case 'Delivered':
      return 'bg-green-100 text-green-800';
    case 'Cancelled':
      return 'bg-red-100 text-red-800';
    case 'Out for Delivery':
      return 'bg-blue-100 text-blue-800';
    case 'Preparing':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const AdminOrders = ({ shopInfo }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const closeConfirm = useCallback(() => {
    if (updating) return;
    setConfirmState(null);
  }, [updating]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getCustomerOrders();
      setOrders(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setError('Unable to load orders right now. Please try Refresh Orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const summary = useMemo(() => {
    const counts = {
      total: orders.length,
      pendingPayment: 0,
      paymentVerified: 0,
      preparing: 0,
      outForDelivery: 0,
      delivered: 0,
    };
    for (const order of orders) {
      const bucket = getPaymentBucket(order);
      if (bucket === 'pending') counts.pendingPayment += 1;
      if (bucket === 'verified') counts.paymentVerified += 1;
      const st = getOrderStatus(order);
      if (st === 'Preparing') counts.preparing += 1;
      if (st === 'Out for Delivery') counts.outForDelivery += 1;
      if (st === 'Delivered') counts.delivered += 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayStart = startOfToday();
    const now = Date.now();

    return orders.filter((order) => {
      const bucket = getPaymentBucket(order);
      if (paymentFilter !== 'all' && bucket !== paymentFilter) return false;

      const st = getOrderStatus(order);
      if (statusFilter !== 'all' && st !== statusFilter) return false;

      const ts = new Date(order.timestamp || order.createdAt || 0).getTime();
      if (dateFilter === 'today' && !(ts >= todayStart)) return false;
      if (dateFilter === '7d' && !(ts >= now - 7 * 24 * 60 * 60 * 1000)) return false;
      if (dateFilter === '30d' && !(ts >= now - 30 * 24 * 60 * 60 * 1000)) return false;

      if (!q) return true;
      const delivery = order.deliveryInfo || {};
      const haystack = [
        order.orderId,
        delivery.customerName,
        delivery.mobileNumber,
        order.transactionId,
        order.paymentRef,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, search, paymentFilter, statusFilter, dateFilter]);

  const refreshSelected = (orderId, patch) => {
    setOrders((prev) =>
      prev.map((o) => (o.orderId === orderId ? { ...o, ...patch } : o)),
    );
    setSelected((prev) =>
      prev && prev.orderId === orderId ? { ...prev, ...patch } : prev,
    );
  };

  const currentPaymentKey = (order) => {
    if (order?.paymentStatus === 'VERIFIED' || order?.paidVerified === true) {
      return 'VERIFIED';
    }
    if (order?.paymentStatus === 'FAILED') return 'FAILED';
    return 'PENDING_CONFIRMATION';
  };

  const paymentLabel = (key) =>
    PAYMENT_ACTIONS.find((p) => p.id === key)?.label || key;

  const DetailLine = ({ label, value }) => (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-600 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right break-all">{value}</span>
    </div>
  );

  const requestPaymentChange = (order, nextStatus) => {
    if (!order?.orderId || updating || confirmState) return;
    const current = currentPaymentKey(order);
    if (nextStatus === current) return;

    const financial = getOrderFinancialBreakdown(order);
    const isVerify = nextStatus === 'VERIFIED';
    const isFailed = nextStatus === 'FAILED';

    setConfirmState({
      kind: 'payment',
      order,
      nextStatus,
      title: isVerify ? 'Verify Payment' : 'Update Payment Status',
      message: isVerify
        ? 'Are you sure you want to mark this payment as verified?'
        : 'Update payment status for this order?',
      confirmText: isVerify ? 'Verify Payment' : 'Update Status',
      cancelText: 'Cancel',
      confirmVariant: isFailed ? 'danger' : isVerify ? 'success' : 'primary',
      notice: 'Financial values and UTR will not change.',
      noticeVariant: 'info',
      details: (
        <>
          <DetailLine label="Order ID" value={order.orderId} />
          {isVerify ? (
            <>
              <DetailLine label="UTR" value={order.transactionId || '—'} />
              <DetailLine label="Amount" value={money(financial.total)} />
            </>
          ) : (
            <>
              <DetailLine label="Current status" value={paymentLabel(current)} />
              <DetailLine label="New status" value={paymentLabel(nextStatus)} />
              <DetailLine label="Amount" value={money(financial.total)} />
            </>
          )}
        </>
      ),
      successMessage: isVerify
        ? 'Payment verified successfully.'
        : 'Payment status updated successfully.',
    });
  };

  const requestOrderStatusChange = (order, nextStatus) => {
    if (!order?.orderId || updating || confirmState) return;
    const current = getOrderStatus(order);
    if (nextStatus === current) return;

    const financial = getOrderFinancialBreakdown(order);
    const customer = order.deliveryInfo?.customerName || '—';

    if (nextStatus === 'Delivered') {
      setConfirmState({
        kind: 'orderStatus',
        order,
        nextStatus,
        title: 'Mark Order as Delivered?',
        message: 'Are you sure this order has been delivered to the customer?',
        confirmText: 'Mark as Delivered',
        cancelText: 'Cancel',
        confirmVariant: 'success',
        notice: 'Financial values will not change.',
        noticeVariant: 'info',
        details: (
          <>
            <DetailLine label="Order ID" value={order.orderId} />
            <DetailLine label="Customer" value={customer} />
            <DetailLine label="Total amount" value={money(financial.total)} />
          </>
        ),
        successMessage: 'Order status updated successfully.',
      });
      return;
    }

    if (nextStatus === 'Cancelled') {
      setConfirmState({
        kind: 'orderStatus',
        order,
        nextStatus,
        title: 'Cancel Order?',
        message: 'Are you sure you want to cancel this order?',
        confirmText: 'Cancel Order',
        cancelText: 'Keep Order',
        confirmVariant: 'danger',
        notice:
          'This action changes the order status to Cancelled. The financial record will be preserved.',
        noticeVariant: 'danger',
        details: (
          <>
            <DetailLine label="Order ID" value={order.orderId} />
            <DetailLine label="Customer" value={customer} />
            <DetailLine label="Total amount" value={money(financial.total)} />
          </>
        ),
        successMessage: 'Order status updated successfully.',
      });
      return;
    }

    setConfirmState({
      kind: 'orderStatus',
      order,
      nextStatus,
      title: 'Update Order Status',
      message: `Change this order from ${current} to ${nextStatus}?`,
      confirmText: 'Update Status',
      cancelText: 'Cancel',
      confirmVariant: 'primary',
      notice: null,
      noticeVariant: 'info',
      details: (
        <>
          <DetailLine label="Order ID" value={order.orderId} />
          <DetailLine label="Current status" value={current} />
          <DetailLine label="New status" value={nextStatus} />
        </>
      ),
      successMessage: 'Order status updated successfully.',
    });
  };

  const executeConfirm = async () => {
    if (!confirmState || updating) return;
    const { kind, order, nextStatus, successMessage } = confirmState;

    setUpdating(true);
    try {
      if (kind === 'payment') {
        const result = await updateCustomerOrderPayment(order.orderId, nextStatus);
        refreshSelected(order.orderId, {
          paymentStatus: result.paymentStatus,
          paidVerified: result.paidVerified,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const result = await updateCustomerOrderStatus(order.orderId, nextStatus);
        refreshSelected(order.orderId, {
          orderStatus: result.orderStatus,
          updatedAt: new Date().toISOString(),
        });
      }
      setConfirmState(null);
      showToast('success', successMessage || 'Updated successfully.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Unable to update the order. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const openDetails = (order) => setSelected(order);
  const closeDetails = () => {
    if (updating || confirmState) return;
    setSelected(null);
  };

  const summaryCards = [
    { label: 'Total Orders', value: summary.total, className: 'bg-white border-blue-100' },
    { label: 'Pending Payment', value: summary.pendingPayment, className: 'bg-orange-50 border-orange-100' },
    { label: 'Payment Verified', value: summary.paymentVerified, className: 'bg-green-50 border-green-100' },
    { label: 'Preparing', value: summary.preparing, className: 'bg-yellow-50 border-yellow-100' },
    { label: 'Out for Delivery', value: summary.outForDelivery, className: 'bg-blue-50 border-blue-100' },
    { label: 'Delivered', value: summary.delivered, className: 'bg-emerald-50 border-emerald-100' },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
          role="status"
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage customer orders, payment verification and delivery status.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Orders
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border shadow-sm p-4 ${card.className}`}
          >
            <p className="text-xs font-medium text-gray-600">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-sm text-gray-700">
            <span className="block mb-1 font-medium">Payment Status</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2"
            >
              {PAYMENT_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1 font-medium">Order Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2"
            >
              {ORDER_STATUS_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            <span className="block mb-1 font-medium">Date</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2"
            >
              {DATE_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-600">
          Loading orders…
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-lg font-semibold text-gray-900">No orders found</p>
          <p className="text-sm text-gray-600 mt-1">
            {orders.length === 0
              ? 'Customer orders will appear here after checkout submission.'
              : 'Try adjusting search or filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order ID</th>
                    <th className="px-4 py-3 font-semibold">Date & Time</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Mobile</th>
                    <th className="px-4 py-3 font-semibold">Items</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Order Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map((order) => {
                    const financial = getOrderFinancialBreakdown(order);
                    const bucket = getPaymentBucket(order);
                    const st = getOrderStatus(order);
                    const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
                    return (
                      <tr key={order.orderId} className="hover:bg-cyan-50/40">
                        <td className="px-4 py-3 font-mono text-blue-700 break-all max-w-[180px]">
                          {order.orderId}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDateTime(order.timestamp || order.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {order.deliveryInfo?.customerName || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {order.deliveryInfo?.mobileNumber || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {money(financial.total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${paymentBadgeClass(bucket)}`}
                          >
                            {getPaymentStatusLabel(order)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${orderStatusBadgeClass(st)}`}
                          >
                            {st}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDetails(order)}
                            className="text-blue-700 font-semibold hover:underline"
                          >
                            View Order →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile / tablet cards */}
          <div className="lg:hidden space-y-3">
            {filteredOrders.map((order) => {
              const financial = getOrderFinancialBreakdown(order);
              const bucket = getPaymentBucket(order);
              const st = getOrderStatus(order);
              return (
                <button
                  key={order.orderId}
                  type="button"
                  onClick={() => openDetails(order)}
                  className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2 active:bg-cyan-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-sm text-blue-700 break-all">{order.orderId}</p>
                    <span className="text-base font-bold text-gray-900 shrink-0">
                      {money(financial.total)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(order.timestamp || order.createdAt)}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {order.deliveryInfo?.customerName || 'Customer'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${paymentBadgeClass(bucket)}`}
                    >
                      {getPaymentStatusLabel(order)}
                    </span>
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${orderStatusBadgeClass(st)}`}
                    >
                      {st}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-blue-700">View Order →</p>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selected && (
        <OrderDetailsModal
          order={selected}
          shopInfo={shopInfo}
          updating={updating || !!confirmState}
          onClose={closeDetails}
          onPaymentChange={requestPaymentChange}
          onOrderStatusChange={requestOrderStatusChange}
        />
      )}

      <AdminConfirmModal
        open={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmText={confirmState?.confirmText || 'Confirm'}
        cancelText={confirmState?.cancelText || 'Cancel'}
        confirmVariant={confirmState?.confirmVariant || 'primary'}
        details={confirmState?.details || null}
        notice={confirmState?.notice || null}
        noticeVariant={confirmState?.noticeVariant || 'info'}
        loading={updating}
        onConfirm={executeConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
};

const OrderDetailsModal = ({
  order,
  shopInfo,
  updating,
  onClose,
  onPaymentChange,
  onOrderStatusChange,
}) => {
  const financial = getOrderFinancialBreakdown(order);
  const discountLabel = formatOrderDiscountLabel(financial);
  const delivery = order.deliveryInfo || {};
  const loc = delivery.location;
  const st = getOrderStatus(order);
  const paymentValue =
    order.paymentStatus === 'VERIFIED' || order.paidVerified === true
      ? 'VERIFIED'
      : order.paymentStatus === 'FAILED'
        ? 'FAILED'
        : 'PENDING_CONFIRMATION';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Order Details</h3>
            <p className="text-xs font-mono text-blue-700 break-all">{order.orderId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <section className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-gray-900">Order Information</h4>
            <Row label="Order ID" value={order.orderId} mono />
            <Row
              label="Order date/time"
              value={formatDateTime(order.timestamp || order.createdAt)}
            />
          </section>

          <section className="bg-blue-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-gray-900">Customer Information</h4>
            <Row label="Customer name" value={delivery.customerName || '—'} />
            <Row label="Mobile number" value={delivery.mobileNumber || '—'} />
          </section>

          <section className="bg-green-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-gray-900">Delivery Information</h4>
            {(order.deliveryDate ||
              order.deliverySlot ||
              delivery.deliveryDate ||
              delivery.deliverySlot) && (
              <Row
                label="Delivery"
                value={`${slotEmoji(order.deliverySlot || delivery.deliverySlot)} ${
                  formatDeliveryPreferenceAdmin(order) || '—'
                }`}
              />
            )}
            <Row label="Address" value={delivery.address || '—'} />
            {delivery.landmark && <Row label="Landmark" value={delivery.landmark} />}
            {delivery.deliveryInstructions && (
              <Row label="Instructions" value={delivery.deliveryInstructions} />
            )}
            {loc?.lat != null && loc?.lng != null && (
              <>
                <Row
                  label="Live location"
                  value={`${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}`}
                  mono
                />
                <a
                  href={
                    loc.navigateUrl ||
                    `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm font-semibold text-blue-700 underline"
                >
                  Open navigation →
                </a>
              </>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-900">Items</h4>
            {(order.items || []).length === 0 ? (
              <p className="text-sm text-gray-600">No items on this order.</p>
            ) : (
              <div className="space-y-2">
                {(order.items || []).map((item, idx) => {
                  const unit = Number(item.price ?? item.rate ?? 0);
                  const qty = normalizeQuantity(item.quantity);
                  const line = calculateLineTotal(item.price || item.rate, item.quantity);
                  return (
                    <div
                      key={`${item.id || item.name}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm border-b border-gray-100 pb-2"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-gray-600">
                          {qty.toFixed(1)} kg × {money(unit)}
                        </p>
                      </div>
                      <p className="font-semibold text-gray-900">{money(line)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="bg-cyan-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-gray-900">Financial Summary</h4>
            <p className="text-xs text-gray-600">
              Saved order snapshot — not recalculated from current prices or offers.
            </p>
            <Row label="Subtotal" value={money(financial.subtotal)} />
            {order.offerName && <Row label="Offer / Promotion" value={order.offerName} />}
            <Row
              label={discountLabel}
              value={financial.discount > 0 ? `-${money(financial.discount)}` : money(0)}
            />
            <Row label="Delivery Charge" value={money(financial.deliveryCharge)} />
            <Row label="Total Payable" value={money(financial.total)} strong />
          </section>

          <section className="bg-orange-50 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-900">Payment Information</h4>
            <Row label="Payment Reference" value={order.paymentRef || '—'} mono />
            <Row label="UTR / Transaction ID" value={order.transactionId || '—'} mono />
            <Row label="Payment Status" value={getPaymentStatusLabel(order)} />

            <label className="block text-sm">
              <span className="font-medium text-gray-700">Update payment status</span>
              <select
                value={paymentValue}
                disabled={updating}
                onChange={(e) => onPaymentChange(order, e.target.value)}
                className="mt-1 w-full border border-orange-200 rounded-xl px-3 py-2 bg-white"
              >
                {PAYMENT_ACTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            {paymentValue !== 'VERIFIED' && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onPaymentChange(order, 'VERIFIED')}
                className="w-full min-h-[44px] rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                Mark Payment Verified
              </button>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-900">Order Status</h4>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Fulfillment status</span>
              <select
                value={st}
                disabled={updating}
                onChange={(e) => onOrderStatusChange(order, e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 bg-white"
              >
                {ORDER_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <button
            type="button"
            onClick={() => openOrderWhatsApp(order, shopInfo)}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold"
          >
            <MessageCircle className="w-5 h-5" />
            Send WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, mono = false, strong = false }) => (
  <div className="flex items-start justify-between gap-3 text-sm">
    <span className="text-gray-600 shrink-0">{label}</span>
    <span
      className={`text-right break-all ${mono ? 'font-mono' : ''} ${
        strong ? 'font-bold text-green-700 text-base' : 'font-medium text-gray-900'
      }`}
    >
      {value}
    </span>
  </div>
);

export default AdminOrders;
