import { Link } from 'react-router-dom';
import {
  formatCompactOrderDate,
  formatOrderNumber,
  formatOrderRupees,
  getOrderItemsColumnLabel,
  getOrderStatusBadgeClass,
} from '../services/customerAccountDashboard';

export const AccountStatusBadge = ({ order }) => (
  <span
    className={`inline-flex min-h-[24px] items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getOrderStatusBadgeClass(order.orderStatus)}`}
  >
    {order.orderStatusLabel}
  </span>
);

const AccountOrderCard = ({
  order,
  actionLabel = 'View Details →',
  onAction,
  actionTo,
  expanded = false,
  children,
}) => {
  const actionClass =
    'inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-[#087EA4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40';

  return (
    <article className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-gray-900">{formatOrderNumber(order)}</p>
        <p className="text-sm font-semibold text-gray-900">{formatOrderRupees(order.totalPrice)}</p>
      </div>
      <p className="mt-0.5 text-sm text-gray-600">
        {formatCompactOrderDate(order)} · {getOrderItemsColumnLabel(order)}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <AccountStatusBadge order={order} />
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={actionClass}
            aria-expanded={expanded}
          >
            {actionLabel}
          </button>
        ) : (
          <Link to={actionTo} className={actionClass}>
            {actionLabel}
          </Link>
        )}
      </div>
      {expanded && children ? (
        <div className="mt-2.5 border-t border-gray-100 pt-2.5">{children}</div>
      ) : null}
    </article>
  );
};

export default AccountOrderCard;
