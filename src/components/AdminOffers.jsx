import { useMemo, useState } from 'react';
import FishImageUpload from './FishImageUpload';
import {
  createOffer,
  updateOffer,
  setOfferEnabled,
  deleteOfferSafe,
} from '../services/firestoreService';
import {
  OFFER_TYPES,
  APPLY_TO_OPTIONS,
  FISH_CATEGORIES,
  getOfferStatus,
  getOfferTypeMeta,
  formatOfferDiscountLabel,
  validateOfferForm,
  countOffersByStatus,
} from '../utils/offerUtils';

const emptyForm = () => ({
  title: '',
  description: '',
  type: 'festival',
  bannerImage: '',
  discountType: 'percentage',
  discountValue: 5,
  minimumOrderAmount: 0,
  maximumDiscount: 0,
  applyTo: 'entire_store',
  productIds: [],
  categoryIds: [],
  startDate: '',
  startTime: '00:00',
  endDate: '',
  endTime: '23:59',
  maxUses: '',
  enabled: true,
});

const statusStyles = {
  active: 'bg-green-100 text-green-800',
  scheduled: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-100 text-gray-700',
  disabled: 'bg-yellow-100 text-yellow-800',
  draft: 'bg-orange-100 text-orange-800',
};

const AdminOffers = ({ fishData, refreshFishData }) => {
  const offers = Array.isArray(fishData?.offers) ? fishData.offers : [];
  const fishes = Array.isArray(fishData?.fishes) ? fishData.fishes : [];

  const [mode, setMode] = useState('list'); // list | create | edit | view
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorList, setErrorList] = useState([]);
  const [viewOffer, setViewOffer] = useState(null);

  const counts = useMemo(() => countOffersByStatus(offers), [offers]);

  const visibleOffers = useMemo(
    () => offers.filter((o) => !o.archived),
    [offers],
  );

  const openCreate = () => {
    setForm(emptyForm());
    setEditingId(null);
    setErrorList([]);
    setMode('create');
  };

  const openEdit = (offer) => {
    setForm({
      title: offer.title || '',
      description: offer.description || '',
      type: offer.type || 'general',
      bannerImage: offer.bannerImage || '',
      discountType: offer.discountType || 'percentage',
      discountValue: offer.discountValue ?? 5,
      minimumOrderAmount: offer.minimumOrderAmount ?? 0,
      maximumDiscount: offer.maximumDiscount ?? 0,
      applyTo: offer.applyTo || 'entire_store',
      productIds: (offer.productIds || []).map(String),
      categoryIds: (offer.categoryIds || []).map(String),
      startDate: offer.startDate || '',
      startTime: offer.startTime || '00:00',
      endDate: offer.endDate || '',
      endTime: offer.endTime || '23:59',
      maxUses: offer.maxUses ?? '',
      enabled: offer.enabled !== false,
    });
    setEditingId(offer.id);
    setErrorList([]);
    setMode('edit');
  };

  const openView = (offer) => {
    setViewOffer(offer);
    setMode('view');
  };

  const cancelForm = () => {
    setMode('list');
    setEditingId(null);
    setViewOffer(null);
    setErrorList([]);
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleProduct = (id) => {
    const sid = String(id);
    setForm((prev) => {
      const set = new Set(prev.productIds.map(String));
      if (set.has(sid)) set.delete(sid);
      else set.add(sid);
      return { ...prev, productIds: Array.from(set) };
    });
  };

  const toggleCategory = (cat) => {
    setForm((prev) => {
      const set = new Set(prev.categoryIds.map(String));
      if (set.has(cat)) set.delete(cat);
      else set.add(cat);
      return { ...prev, categoryIds: Array.from(set) };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = validateOfferForm(form);
    if (errors.length) {
      setErrorList(errors);
      return;
    }
    setSaving(true);
    setErrorList([]);
    try {
      if (mode === 'edit' && editingId) {
        await updateOffer(editingId, form);
      } else {
        await createOffer(form);
      }
      if (typeof refreshFishData === 'function') {
        await refreshFishData();
      }
      setMode('list');
      setEditingId(null);
      alert(mode === 'edit' ? 'Offer updated successfully!' : 'Offer created successfully!');
    } catch (err) {
      console.error(err);
      setErrorList([err.message || 'Failed to save offer. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (offer) => {
    try {
      await setOfferEnabled(offer.id, offer.enabled === false);
      if (typeof refreshFishData === 'function') await refreshFishData();
    } catch (err) {
      alert('Failed to update offer status.');
    }
  };

  const handleDelete = async (offer) => {
    const used = Number(offer.usedCount) || 0;
    const msg =
      used > 0
        ? `"${offer.title}" was used on ${used} order(s). It will be disabled/archived instead of permanently deleted. Continue?`
        : `Delete offer "${offer.title}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      const result = await deleteOfferSafe(offer);
      if (typeof refreshFishData === 'function') await refreshFishData();
      alert(
        result.action === 'archived'
          ? 'Offer archived (kept for order history).'
          : 'Offer deleted.',
      );
    } catch (err) {
      alert('Failed to delete offer.');
    }
  };

  if (mode === 'view' && viewOffer) {
    const status = getOfferStatus(viewOffer);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-gray-900">Offer Details</h2>
          <button type="button" onClick={cancelForm} className="btn-secondary">
            Back to List
          </button>
        </div>
        <div className="card p-6 space-y-4">
          {viewOffer.bannerImage && (
            <img
              src={viewOffer.bannerImage}
              alt={viewOffer.title}
              className="w-full max-h-56 object-cover rounded-xl border"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900">{viewOffer.title}</h3>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusStyles[status]}`}>
              {status}
            </span>
          </div>
          <p className="text-gray-600">{viewOffer.description || '—'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <p><span className="font-medium">Type:</span> {getOfferTypeMeta(viewOffer.type).label}</p>
            <p><span className="font-medium">Discount:</span> {formatOfferDiscountLabel(viewOffer)}</p>
            <p><span className="font-medium">Period:</span> {viewOffer.startDate} {viewOffer.startTime} → {viewOffer.endDate} {viewOffer.endTime}</p>
            <p><span className="font-medium">Apply to:</span> {viewOffer.applyTo?.replace(/_/g, ' ')}</p>
            <p><span className="font-medium">Min order:</span> ₹{Number(viewOffer.minimumOrderAmount || 0)}</p>
            <p><span className="font-medium">Max discount:</span> {viewOffer.maximumDiscount ? `₹${viewOffer.maximumDiscount}` : '—'}</p>
            <p><span className="font-medium">Uses:</span> {Number(viewOffer.usedCount || 0)}{viewOffer.maxUses ? ` / ${viewOffer.maxUses}` : ''}</p>
            <p><span className="font-medium">Enabled:</span> {viewOffer.enabled === false ? 'No' : 'Yes'}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-primary" onClick={() => openEdit(viewOffer)}>Edit</button>
            <button type="button" className="btn-secondary" onClick={() => handleToggle(viewOffer)}>
              {viewOffer.enabled === false ? 'Enable' : 'Disable'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'edit' ? 'Edit Offer' : 'Create New Offer'}
          </h2>
          <button type="button" onClick={cancelForm} className="btn-secondary">
            Cancel
          </button>
        </div>

        <form onSubmit={handleSave} className="card p-6 space-y-6">
          {errorList.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm space-y-1">
              {errorList.map((err) => (
                <p key={err}>{err}</p>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Offer Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Offer Type *</label>
              <select
                value={form.type}
                onChange={(e) => updateField('type', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              >
                {OFFER_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Short Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
            <FishImageUpload
              label="Banner Image (16:9 recommended)"
              id="offer-banner-upload"
              value={form.bannerImage}
              onChange={(url) => updateField('bannerImage', url)}
            />
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Offer Period</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateField('startTime', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateField('endTime', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Discount</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type *</label>
                <select
                  value={form.discountType}
                  onChange={(e) => updateField('discountType', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Value * {form.discountType === 'percentage' ? '(%)' : '(₹)'}
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.discountValue}
                  onChange={(e) => updateField('discountValue', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Order Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.minimumOrderAmount}
                  onChange={(e) => updateField('minimumOrderAmount', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.maximumDiscount}
                  onChange={(e) => updateField('maximumDiscount', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  placeholder="Optional cap for %"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Apply Offer To</h3>
            <div className="space-y-2">
              {APPLY_TO_OPTIONS.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="applyTo"
                    checked={form.applyTo === opt.id}
                    onChange={() => updateField('applyTo', opt.id)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {form.applyTo === 'selected_products' && (
              <div className="max-h-56 overflow-y-auto border rounded-xl p-3 space-y-2 bg-gray-50">
                {fishes.length === 0 && (
                  <p className="text-sm text-gray-500">No products available.</p>
                )}
                {fishes.map((fish) => (
                  <label key={fish.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.productIds.map(String).includes(String(fish.id))}
                      onChange={() => toggleProduct(fish.id)}
                    />
                    <span>{fish.name}</span>
                  </label>
                ))}
              </div>
            )}

            {form.applyTo === 'selected_categories' && (
              <div className="space-y-2">
                {FISH_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                    />
                    {cat}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Uses</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.maxUses}
                onChange={(e) => updateField('maxUses', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                placeholder="Optional"
              />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => updateField('enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              Enable Offer
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button type="button" onClick={cancelForm} className="btn-secondary flex-1" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving…' : 'Save Offer'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Offers & Promotions</h2>
        <button type="button" onClick={openCreate} className="btn-primary">
          + Create Offer
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'active', label: 'Active Offers', value: counts.active },
          { key: 'scheduled', label: 'Scheduled Offers', value: counts.scheduled },
          { key: 'expired', label: 'Expired Offers', value: counts.expired },
          { key: 'disabled', label: 'Disabled', value: counts.disabled },
        ].map((card) => (
          <div key={card.key} className="card p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{card.value}</div>
            <div className="text-xs sm:text-sm text-gray-600 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {visibleOffers.length === 0 ? (
        <div className="card p-8 text-center text-gray-600">
          No offers yet. Click <strong>+ Create Offer</strong> to add your first promotion.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Offer</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleOffers.map((offer) => {
                const status = getOfferStatus(offer);
                return (
                  <tr key={offer.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{offer.title}</td>
                    <td className="px-4 py-3">{getOfferTypeMeta(offer.type).label}</td>
                    <td className="px-4 py-3">{formatOfferDiscountLabel(offer)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {offer.startDate} → {offer.endDate}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${statusStyles[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="text-blue-600 hover:underline" onClick={() => openView(offer)}>View</button>
                        <button type="button" className="text-blue-600 hover:underline" onClick={() => openEdit(offer)}>Edit</button>
                        <button type="button" className="text-amber-700 hover:underline" onClick={() => handleToggle(offer)}>
                          {offer.enabled === false ? 'Enable' : 'Disable'}
                        </button>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => handleDelete(offer)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminOffers;
