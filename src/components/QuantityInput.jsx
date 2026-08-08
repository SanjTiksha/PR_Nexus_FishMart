import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  QUANTITY_LIMITS,
  normalizeQuantity,
  validateQuantity,
  calculateLineTotal,
} from '../utils/quantityUtils';

const DEFAULT_PRESETS = [0.5, 1, 2, 5, 10];
const CARD_PRESETS = [0.5, 1, 2];

const QuantityInput = ({
  value = QUANTITY_LIMITS.MIN,
  onChange,
  onValidityChange,
  rate,
  label = 'Select Quantity (kg)',
  helperText = 'Tap weight or use +/- (0.5 kg steps)',
  presetOptions = DEFAULT_PRESETS,
  disabled = false,
  variant = 'default',
}) => {
  const [inputValue, setInputValue] = useState(value.toFixed(1));
  const [error, setError] = useState('');
  const visiblePresets = (presetOptions || DEFAULT_PRESETS).slice(0, 5);

  useEffect(() => {
    const formatted = normalizeQuantity(value).toFixed(1);
    if (formatted !== inputValue) {
      setInputValue(formatted);
    }
  }, [value]);

  const lastValidityRef = useRef(null);

  useEffect(() => {
    if (!onValidityChange) return;

    const isValid = !error;
    if (lastValidityRef.current !== isValid) {
      lastValidityRef.current = isValid;
      onValidityChange(isValid);
    }
  }, [error, onValidityChange]);

  const commitValue = (rawValue) => {
    const result = validateQuantity(rawValue);

    if (!result.valid) {
      if (result.message.includes('between')) {
        setError(result.message);
        setInputValue(normalizeQuantity(value).toFixed(1));
        if (onValidityChange) {
          onValidityChange(false);
        }
        return;
      }

      const corrected = normalizeQuantity(result.normalized);
      setError('');
      setInputValue(corrected.toFixed(1));
      if (typeof onChange === 'function') {
        onChange(corrected);
      }
      if (onValidityChange) {
        onValidityChange(true);
      }
      return;
    }

    setError('');
    const normalized = normalizeQuantity(result.normalized);
    setInputValue(normalized.toFixed(1));
    if (typeof onChange === 'function') {
      onChange(normalized);
    }
    if (onValidityChange) {
      onValidityChange(true);
    }
  };

  const handleInputChange = (event) => {
    const raw = event.target.value;
    setInputValue(raw);

    const { valid, message } = validateQuantity(raw);
    setError(valid ? '' : message);

    if (onValidityChange) {
      onValidityChange(valid);
    }

    if (valid && typeof onChange === 'function') {
      onChange(normalizeQuantity(raw));
    }
  };

  const adjustQuantity = (direction) => {
    const parsed = parseFloat(inputValue);
    const base = Number.isNaN(parsed) ? value : parsed;
    const delta = direction === 'increment' ? QUANTITY_LIMITS.STEP : -QUANTITY_LIMITS.STEP;
    const next = normalizeQuantity(base + delta);
    commitValue(next);
  };

  const handleQuickSelect = (preset) => {
    const normalized = normalizeQuantity(preset);
    setError('');
    setInputValue(normalized.toFixed(1));
    if (typeof onChange === 'function') {
      onChange(normalized);
    }
  };

  const isCompact = variant === 'compact';
  const isCard = variant === 'card';
  const displaySubtotal =
    typeof rate === 'number' && !Number.isNaN(rate)
      ? calculateLineTotal(rate, normalizeQuantity(inputValue))
      : null;

  return (
    <div className={isCompact || isCard ? 'space-y-1.5' : 'space-y-3'}>
      {isCard && (
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-gray-600">Qty (kg)</label>
          {displaySubtotal !== null && (
            <span className="text-xs font-semibold text-blue-600 truncate">
              ₹{displaySubtotal.toFixed(0)} · {normalizeQuantity(inputValue).toFixed(1)} kg
            </span>
          )}
        </div>
      )}

      {!isCompact && !isCard && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          {displaySubtotal !== null && (
            <span className="text-sm font-semibold text-blue-600">
              ₹{displaySubtotal.toFixed(2)} for {normalizeQuantity(inputValue).toFixed(1)} kg
            </span>
          )}
        </div>
      )}

      <div
        className={`flex items-center justify-center border border-gray-200 rounded-lg bg-white ${
          isCard ? 'space-x-1 px-1 py-0.5' : isCompact ? 'space-x-2 px-2 py-1.5' : 'space-x-3 px-2 py-1.5 sm:px-3 sm:py-2'
        } min-w-[110px]`}
      >
        <button
          type="button"
          onClick={() => adjustQuantity('decrement')}
          disabled={disabled}
          className={`${
            isCard ? 'p-2 min-h-[40px] min-w-[40px]' : 'p-3 sm:p-2 touch-target'
          } rounded-lg active:bg-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
          aria-label="Decrease quantity"
        >
          <Minus className={isCard ? 'w-4 h-4' : 'w-5 h-5 sm:w-4 sm:h-4'} />
        </button>

        <div className={`flex-1 text-center font-medium text-blue-600 ${isCompact || isCard ? 'text-sm' : 'text-base'}`}>
          <input
            type="number"
            inputMode="decimal"
            min={QUANTITY_LIMITS.MIN}
            max={QUANTITY_LIMITS.MAX}
            step={QUANTITY_LIMITS.STEP}
            value={inputValue}
            disabled={disabled}
            onChange={handleInputChange}
            onBlur={() => commitValue(inputValue)}
            className={`w-full max-w-[3.5rem] mx-auto bg-transparent text-blue-600 font-semibold focus:outline-none text-center px-1 text-base ${
              isCard ? 'py-1' : 'py-2'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={() => adjustQuantity('increment')}
          disabled={disabled}
          className={`${
            isCard ? 'p-2 min-h-[40px] min-w-[40px]' : 'p-3 sm:p-2 touch-target'
          } rounded-lg active:bg-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`}
          aria-label="Increase quantity"
        >
          <Plus className={isCard ? 'w-4 h-4' : 'w-5 h-5 sm:w-4 sm:h-4'} />
        </button>
      </div>

      {error && <p className="text-[11px] text-red-500 leading-tight">{error}</p>}
      {!error && helperText && !isCompact && !isCard && (
        <p className="text-xs text-gray-500">{helperText}</p>
      )}

      {isCard && (
        <div className="grid grid-cols-3 gap-1">
          {CARD_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleQuickSelect(preset)}
              className={`min-h-[34px] px-1 py-1 rounded-lg border text-xs font-medium transition-colors ${
                normalizeQuantity(inputValue) === normalizeQuantity(preset)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 active:border-blue-300'
              }`}
            >
              {preset} kg
            </button>
          ))}
        </div>
      )}

      {!isCompact && !isCard && (
        <div className="flex flex-wrap gap-2">
          {visiblePresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleQuickSelect(preset)}
              className={`min-h-[40px] px-3.5 py-2 rounded-full border text-sm transition-colors ${
                normalizeQuantity(inputValue) === normalizeQuantity(preset)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-600 active:border-blue-300'
              }`}
            >
              {preset} kg
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuantityInput;
