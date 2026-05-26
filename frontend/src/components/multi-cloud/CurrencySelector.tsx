/**
 * CurrencySelector Component - Task 16.2
 * Dropdown to select display currency. Persists to localStorage.
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, ChevronDown } from 'lucide-react';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' }
];

const STORAGE_KEY = 'multicloud_currency';

const CurrencySelector = ({ value, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState({});

  // Load persisted currency
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !value) onChange?.(saved);
  }, []);

  // Fetch exchange rates
  useEffect(() => {
    fetch('/api/currency/rates')
      .then(r => r.json())
      .then(data => { if (data.status === 'success') setRates(data.data.rates || {}); })
      .catch(() => {});
  }, []);

  const handleSelect = (code) => {
    localStorage.setItem(STORAGE_KEY, code);
    onChange?.(code);
    setOpen(false);
  };

  const selected = CURRENCIES.find(c => c.code === (value || 'USD')) || CURRENCIES[0];

  const convertPrice = (usdPrice, targetCurrency) => {
    const rate = rates[targetCurrency] || 1;
    return (usdPrice * rate).toFixed(4);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm transition-colors"
        aria-label="Select currency"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <DollarSign className="w-4 h-4 text-white/60" />
        <span>{selected.code}</span>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Currency options"
          className="absolute right-0 top-full mt-1 w-56 bg-gray-900/95 backdrop-blur border border-white/20 rounded-xl overflow-hidden z-50 shadow-2xl"
        >
          <div className="p-2 text-xs text-white/40 border-b border-white/10 px-3">
            Select Display Currency
          </div>
          <div className="max-h-64 overflow-y-auto">
            {CURRENCIES.map(currency => (
              <button
                key={currency.code}
                role="option"
                aria-selected={currency.code === value}
                onClick={() => handleSelect(currency.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                  currency.code === value ? 'text-blue-400 bg-blue-500/10' : 'text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 text-white/60">{currency.symbol}</span>
                  <span>{currency.code}</span>
                </div>
                <span className="text-white/40 text-xs">{currency.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { CURRENCIES };
export const convertPrice = (price: number, currency: string, rates: any) => (price * (rates[currency] || 1));
export default CurrencySelector;
