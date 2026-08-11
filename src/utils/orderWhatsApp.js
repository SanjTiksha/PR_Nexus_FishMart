/**
 * Shared WhatsApp order message builder.
 * Uses saved order snapshot only — never recalculates money or writes Firestore.
 */

import { calculateLineTotal, normalizeQuantity } from './quantityUtils';
import {
  getOrderFinancialBreakdown,
  formatOrderDiscountLabel,
} from './orderFinancialDisplay';
import { formatDeliveryPreferenceLabel, slotEmoji } from './deliverySlot';

const formatOrderDate = (timestamp) => {
  if (!timestamp) return 'Not provided';
  return new Date(timestamp).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getPaymentStatusLabel = (order) => {
  if (!order) return 'Pending Verification';
  if (order.paymentStatus === 'FAILED') return 'Payment Failed';
  if (order.paymentStatus === 'VERIFIED' || order.paidVerified === true) {
    return 'Payment Verified';
  }
  if (
    order.paymentStatus === 'PENDING_CONFIRMATION' ||
    order.paidVerified === false
  ) {
    return 'Pending Verification';
  }
  return String(order.paymentStatus || 'Pending Verification');
};

export const buildOrderWhatsAppMessage = (order, shopInfo = {}) => {
  const financial = getOrderFinancialBreakdown(order);
  const discountLabel = formatOrderDiscountLabel(financial);
  const deliveryInfo = order?.deliveryInfo || {};
  const paymentStatusLabel = getPaymentStatusLabel(order);

  const orderSummary = (order?.items || [])
    .map(
      (item) =>
        `• ${item.name} (Qty: ${normalizeQuantity(item.quantity).toFixed(1)} kg) - ₹${calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}`,
    )
    .join('\n');

  const discountText =
    financial.discount > 0
      ? `\n*Subtotal:* ₹${financial.subtotal.toFixed(2)}\n*${discountLabel}:* -₹${financial.discount.toFixed(2)}`
      : `\n*Subtotal:* ₹${financial.subtotal.toFixed(2)}\n*Discount:* ₹0.00`;

  let deliveryAddress = '';
  if (deliveryInfo.address || deliveryInfo.location?.lat) {
    deliveryAddress = `\n\n*📍 Delivery Address:*
*Name:* ${deliveryInfo.customerName || 'Not provided'}
*Mobile:* ${deliveryInfo.mobileNumber || 'Not provided'}
*Address:* ${deliveryInfo.address || 'Not provided'}`;

    if (deliveryInfo.landmark) {
      deliveryAddress += `\n*Landmark:* ${deliveryInfo.landmark}`;
    }

    if (deliveryInfo.deliveryInstructions) {
      deliveryAddress += `\n*Delivery Instructions:* ${deliveryInfo.deliveryInstructions}`;
    }

    const loc = deliveryInfo.location;
    if (loc?.lat && loc?.lng) {
      deliveryAddress += `\n\n*📍 Live Delivery Location:*
*Coordinates:* ${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}${loc.accuracy ? `\n*GPS Accuracy:* ±${Math.round(loc.accuracy)}m` : ''}
*Google Maps:* ${loc.mapsUrl || `https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
*Navigate (for delivery boy):* ${loc.navigateUrl || `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`}`;
    }
  }

  const deliveryPrefLabel = formatDeliveryPreferenceLabel(order);
  const deliveryPrefLine = deliveryPrefLabel
    ? `\n*Delivery:* ${slotEmoji(order?.deliverySlot || deliveryInfo.deliverySlot)} ${deliveryPrefLabel}`
    : '';

  return `🐟 *Order Details* — PR Nexus FishMart

*Order ID:* ${order?.orderId || 'Not provided'}
*Customer:* ${deliveryInfo.customerName || 'Not provided'}
*Mobile:* ${deliveryInfo.mobileNumber || 'Not provided'}
*Date:* ${formatOrderDate(order?.timestamp || order?.createdAt)}${deliveryPrefLine}

*Items Ordered:*
${orderSummary || '• No items'}${discountText}
*Final Total:* ₹${financial.total.toFixed(2)}
${order?.offerName ? `*Offer:* ${order.offerName}` : ''}

*Payment / UTR:* ${order?.transactionId || 'Not provided'}
${order?.paymentRef ? `*Payment Ref:* ${order.paymentRef}` : ''}
*Payment Status:* ${paymentStatusLabel}
*Order Status:* ${order?.orderStatus || 'Processing'}

${deliveryAddress}

*Shop:* ${shopInfo?.name || 'PR Nexus FishMart'}
*Contact:* ${shopInfo?.phone?.replace(/[^\d+]/g, '') || 'Contact shop for details'}

Order is already recorded. Please verify payment and process.`;
};

/** Open WhatsApp with the saved order snapshot. Never writes Firestore. */
export const openOrderWhatsApp = (order, shopInfo = {}) => {
  const message = buildOrderWhatsAppMessage(order, shopInfo);
  const whatsappUrl = `https://wa.me/${shopInfo?.whatsapp || '919096205136'}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
};
