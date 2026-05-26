/**
 * CostEstimator Component - Task 11.1
 * Interactive cost estimation with usage parameter inputs.
 */

import React, { useState } from 'react';
import { Calculator, Clock, HardDrive, Globe, Zap, Loader } from 'lucide-react';
import CostBreakdown from './CostBreakdown';

const CostEstimator = ({ selectedProviders = [], selectedCategories = [], className = '' }) => {
  const [params, setParams] = useState({
    compute_hours: 730,
    storage_gb: 0,
    network_egress_gb: 0,
    api_calls: 0,
    data_transfer_gb: 0
  });
  const [duration, setDuration] = useState('monthly');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const durationMultipliers = {
    hourly: 1 / 730,
    daily: 24 / 730,
    monthly: 1,
    annual: 12
  };

  const handleEstimate = async () => {
    if (selectedProviders.length === 0) {
      setError('Select at least one provider first');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cost/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: selectedProviders,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
          ...params
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setResult(data.data);
      } else {
        setError(data.message || 'Estimation failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCost = (cost) => {
    const multiplier = durationMultipliers[duration];
    return (cost * multiplier).toFixed(2);
  };

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-6 h-6 text-blue-400" />
        <h3 className="text-xl font-semibold text-white">Cost Estimator</h3>
      </div>

      {/* Usage Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="flex items-center gap-2 text-sm text-white/80 mb-2">
            <Clock className="w-4 h-4" /> Compute Hours/Month
          </label>
          <input
            type="number"
            value={params.compute_hours}
            onChange={e => setParams(p => ({ ...p, compute_hours: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
            min="0" max="744"
          />
          <p className="text-xs text-white/40 mt-1">730 = 24/7 for a month</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-white/80 mb-2">
            <HardDrive className="w-4 h-4" /> Storage (GB)
          </label>
          <input
            type="number"
            value={params.storage_gb}
            onChange={e => setParams(p => ({ ...p, storage_gb: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
            min="0"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-white/80 mb-2">
            <Globe className="w-4 h-4" /> Network Egress (GB)
          </label>
          <input
            type="number"
            value={params.network_egress_gb}
            onChange={e => setParams(p => ({ ...p, network_egress_gb: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
            min="0"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-white/80 mb-2">
            <Zap className="w-4 h-4" /> API Calls/Month
          </label>
          <input
            type="number"
            value={params.api_calls}
            onChange={e => setParams(p => ({ ...p, api_calls: parseInt(e.target.value) || 0 }))}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
            min="0"
          />
        </div>
      </div>

      {/* Duration Selector */}
      <div className="flex gap-2 mb-6">
        {['hourly', 'daily', 'monthly', 'annual'].map(d => (
          <button
            key={d}
            onClick={() => setDuration(d)}
            className={`flex-1 py-2 rounded-lg text-sm capitalize transition-colors ${
              duration === d
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Estimate Button */}
      <button
        onClick={handleEstimate}
        disabled={loading || selectedProviders.length === 0}
        className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
        {loading ? 'Calculating...' : 'Calculate Cost'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6">
          {/* Total Cost Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {['hourly', 'daily', 'monthly', 'annual'].map(period => (
              <div
                key={period}
                className={`p-3 rounded-lg border text-center ${
                  period === duration
                    ? 'bg-blue-500/20 border-blue-500/40'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="text-xs text-white/60 capitalize mb-1">{period}</div>
                <div className="text-lg font-bold text-white">
                  ${result.totals[period]?.toFixed(period === 'hourly' ? 4 : 2)}
                </div>
              </div>
            ))}
          </div>

          <CostBreakdown result={result} duration={duration} />
        </div>
      )}
    </div>
  );
};

export default CostEstimator;
