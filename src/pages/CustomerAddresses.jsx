import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import AccountLayout from '../components/AccountLayout';
import DeliveryLocationPicker from '../components/DeliveryLocationPicker';
import EnhancedLoadingSpinner from '../components/EnhancedLoadingSpinner';
import { getAccountRedirectPath } from '../services/customerSession';
import { ensureCustomerProfile } from '../services/customerProfile';
import {
  ADDRESSES_LIMIT_MESSAGE,
  ADDRESSES_UNAVAILABLE_MESSAGE,
  ADDRESS_LABELS,
  MAX_CUSTOMER_ADDRESSES,
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  setDefaultCustomerAddress,
  toCustomerAddressView,
  updateCustomerAddress,
} from '../services/customerAddresses';

const EMPTY_FORM = {
  label: 'Home',
  fullName: '',
  mobile10: '',
  address: '',
  landmark: '',
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);

const CustomerAddresses = () => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loadStatus, setLoadStatus] = useState('loading');
  const [addresses, setAddresses] = useState([]);
  const [defaultAddressId, setDefaultAddressId] = useState('');
  const [mode, setMode] = useState('list');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [location, setLocation] = useState(null);
  const [initialMapLocation, setInitialMapLocation] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [setAsDefault, setSetAsDefault] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const loadAddresses = useCallback(async (user) => {
    if (!user || getAccountRedirectPath(user)) {
      setAddresses([]);
      setLoadStatus('ok');
      return;
    }

    setLoadStatus('loading');
    await ensureCustomerProfile(user);
    const result = await getCustomerAddresses(user);
    setDefaultAddressId(result.defaultAddressId || '');
    setAddresses(result.addresses || []);
    setLoadStatus(result.status === 'unavailable' ? 'unavailable' : 'ok');
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;
    let cancelled = false;
    loadAddresses(firebaseUser).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser, loadAddresses]);

  const openCreate = () => {
    setEditingId('');
    setForm(EMPTY_FORM);
    setLocation(null);
    setInitialMapLocation(null);
    setFormError('');
    setSetAsDefault(false);
    setMode('form');
  };

  const openEdit = (address) => {
    setEditingId(address.addressId);
    setForm({
      label: ADDRESS_LABELS.includes(address.label) ? address.label : 'Home',
      fullName: address.fullName || '',
      mobile10: address.mobile10 || '',
      address: address.address || '',
      landmark: address.landmark || '',
    });
    setLocation(address.location || null);
    setInitialMapLocation(address.location || null);
    setFormError('');
    setSetAsDefault(address.addressId === defaultAddressId);
    setMode('form');
  };

  const closeForm = () => {
    setMode('list');
    setEditingId('');
    setForm(EMPTY_FORM);
    setLocation(null);
    setInitialMapLocation(null);
    setFormError('');
    setSetAsDefault(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    setFormError('');
    setSaving(true);
    try {
      const input = {
        ...form,
        mobile10: digitsOnly(form.mobile10),
        location,
      };
      const result = editingId
        ? await updateCustomerAddress(firebaseUser, editingId, input)
        : await createCustomerAddress(firebaseUser, input);

      if (result.status === 'ok') {
        const shouldSetDefault =
          Boolean(editingId) && setAsDefault && editingId !== defaultAddressId;
        if (shouldSetDefault) {
          const defaultResult = await setDefaultCustomerAddress(firebaseUser, editingId);
          if (defaultResult.status !== 'ok') {
            setFormError(ADDRESSES_UNAVAILABLE_MESSAGE);
            await loadAddresses(firebaseUser);
            return;
          }
        }
        closeForm();
        await loadAddresses(firebaseUser);
        return;
      }
      if (result.status === 'limit') {
        setFormError(ADDRESSES_LIMIT_MESSAGE);
        return;
      }
      if (result.status === 'invalid') {
        setFormError('Please check the recipient name, mobile, address, label, and confirmed map pin.');
        return;
      }
      setFormError(ADDRESSES_UNAVAILABLE_MESSAGE);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    const result = await setDefaultCustomerAddress(firebaseUser, addressId);
    if (result.status === 'ok') {
      await loadAddresses(firebaseUser);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || saving) return;
    setSaving(true);
    try {
      const result = await deleteCustomerAddress(firebaseUser, pendingDelete.addressId);
      setPendingDelete(null);
      if (result.status === 'ok') {
        await loadAddresses(firebaseUser);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!authReady) {
    return <EnhancedLoadingSpinner message="Loading your addresses..." size="large" />;
  }

  const accountRedirect = getAccountRedirectPath(firebaseUser);
  if (accountRedirect) {
    return <Navigate to={accountRedirect} replace />;
  }

  const views = addresses.map((address) => toCustomerAddressView(address, defaultAddressId));
  const atLimit = addresses.length >= MAX_CUSTOMER_ADDRESSES;

  return (
    <>
    <AccountLayout current="addresses">
          <div className="space-y-4 min-w-0">
            <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
                Saved Addresses
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Save your delivery details for faster checkout.
              </p>
              {mode === 'list' ? (
                <button
                  type="button"
                  onClick={openCreate}
                  disabled={atLimit}
                  className="mt-3 flex w-full min-h-[48px] items-center justify-center rounded-xl bg-[#087EA4] px-6 text-base font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087EA4]/40 disabled:opacity-50"
                >
                  + Add Address
                </button>
              ) : null}
              {atLimit && mode === 'list' ? (
                <p className="mt-3 text-sm text-gray-600">{ADDRESSES_LIMIT_MESSAGE}</p>
              ) : null}
            </section>

            {loadStatus === 'loading' ? (
              <section className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                <p className="text-base font-semibold text-gray-800">Loading your addresses...</p>
              </section>
            ) : null}

            {loadStatus === 'unavailable' ? (
              <section className="rounded-xl border border-gray-200 bg-white p-4 text-center space-y-4">
                <p className="text-base font-semibold text-gray-900" role="alert">
                  {ADDRESSES_UNAVAILABLE_MESSAGE}
                </p>
                <button
                  type="button"
                  onClick={() => loadAddresses(firebaseUser)}
                  className="mx-auto flex w-full max-w-xs min-h-[48px] items-center justify-center rounded-xl bg-[#087EA4] px-6 text-base font-bold text-white"
                >
                  Retry
                </button>
              </section>
            ) : null}

            {mode === 'form' ? (
              <section className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId ? 'Edit address' : 'Add address'}
                </h2>
                <form className="mt-4 space-y-4" onSubmit={handleSave}>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold text-gray-800">Address label</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {ADDRESS_LABELS.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, label }))}
                          className={`min-h-[48px] rounded-xl border text-sm font-semibold ${
                            form.label === label
                              ? 'border-[#087EA4] bg-cyan-50 text-gray-900'
                              : 'border-gray-200 bg-white text-gray-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Recipient name</span>
                    <input
                      value={form.fullName}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, fullName: event.target.value }))
                      }
                      maxLength={80}
                      autoComplete="name"
                      className="mt-1 w-full min-h-[48px] rounded-xl border border-gray-200 px-4 text-base text-gray-900"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Delivery mobile</span>
                    <input
                      value={form.mobile10}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, mobile10: digitsOnly(event.target.value) }))
                      }
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="tel"
                      className="mt-1 w-full min-h-[48px] rounded-xl border border-gray-200 px-4 text-base text-gray-900"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Address</span>
                    <textarea
                      value={form.address}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, address: event.target.value }))
                      }
                      rows={3}
                      maxLength={500}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 break-words"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Landmark optional</span>
                    <input
                      value={form.landmark}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, landmark: event.target.value }))
                      }
                      maxLength={120}
                      className="mt-1 w-full min-h-[48px] rounded-xl border border-gray-200 px-4 text-base text-gray-900"
                    />
                  </label>

                  <DeliveryLocationPicker
                    key={editingId || 'new-address'}
                    initialLocation={initialMapLocation}
                    onChange={setLocation}
                  />

                  {formError ? (
                    <p className="text-sm text-red-700" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  {editingId ? (
                    editingId === defaultAddressId ? (
                      <div
                        className="flex w-full min-h-[48px] items-center justify-center rounded-xl border border-[#087EA4] bg-cyan-50 px-4 text-sm font-semibold text-gray-900"
                        aria-current="true"
                      >
                        Default address
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSetAsDefault((current) => !current)}
                        aria-pressed={setAsDefault}
                        className={`flex w-full min-h-[48px] items-center justify-center rounded-xl border px-4 text-sm font-semibold ${
                          setAsDefault
                            ? 'border-[#087EA4] bg-cyan-50 text-gray-900'
                            : 'border-gray-200 bg-white text-gray-900'
                        }`}
                      >
                        Set as default address
                      </button>
                    )
                  ) : null}

                  <button
                    type="submit"
                    disabled={saving}
                    className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-[#087EA4] px-6 text-base font-bold text-white disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Address'}
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex w-full min-h-[48px] items-center justify-center rounded-xl border border-gray-200 bg-white px-6 text-base font-semibold text-gray-900"
                  >
                    Cancel
                  </button>
                </form>
              </section>
            ) : null}

            {mode === 'list' && loadStatus === 'ok' && views.length === 0 ? (
              <section className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                <p className="text-base text-gray-600">No saved delivery addresses yet.</p>
              </section>
            ) : null}

            {mode === 'list' && loadStatus === 'ok' ? (
              <section className="space-y-2" aria-label="Saved addresses">
                {views.map((view) => (
                  <article
                    key={view.addressId}
                    className="rounded-xl border border-gray-200 bg-white p-3 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-bold text-gray-900">{view.label}</p>
                      {view.isDefault ? (
                        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 break-words font-semibold text-gray-900">{view.fullName}</p>
                    {view.mobileMasked ? (
                      <p className="text-sm text-gray-700">{view.mobileMasked}</p>
                    ) : null}
                    <p className="mt-1 break-words text-sm text-gray-700">{view.address}</p>
                    <p className="mt-1.5 text-xs font-semibold text-green-800">
                      {view.locationConfirmed ? 'Location confirmed' : 'Location needed'}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(addresses.find((item) => item.addressId === view.addressId))}
                        className="min-h-[44px] rounded-xl border border-gray-200 bg-cyan-50 px-3 text-sm font-bold text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(view)}
                        className="min-h-[44px] rounded-xl border border-red-100 bg-white px-3 text-sm font-bold text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                    {!view.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(view.addressId)}
                        className="mt-2 flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900"
                      >
                        Set as Default
                      </button>
                    ) : null}
                  </article>
                ))}
              </section>
            ) : null}
          </div>
    </AccountLayout>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Delete this address?</h2>
            <p className="mt-2 text-sm text-gray-600">This saved delivery address will be removed.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="min-h-[48px] rounded-xl border border-gray-200 bg-white font-semibold text-gray-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={saving}
                className="min-h-[48px] rounded-xl bg-red-600 font-bold text-white disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CustomerAddresses;
