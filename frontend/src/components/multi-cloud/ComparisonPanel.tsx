/**
 * ComparisonPanel Component
 * 
 * Side-by-side service comparison with price differences.
 * Allows users to compare services across providers.
 * 
 * Requirements:
 *   - Requirement 9.1: Side-by-side comparison
 *   - Requirement 9.2: Price difference highlighting
 *   - Requirement 9.3: Cheapest option indication
 * 
 * Features:
 *   - Add/remove services to comparison
 *   - Price difference calculations
 *   - Cheapest option highlighting
 *   - Specification comparison
 *   - Export comparison
 */

import React, { useState } from 'react';
import { X, TrendingDown, Award, Download, Plus } from 'lucide-react';
import ComparisonChart from './ComparisonChart';

const ComparisonPanel = ({
  comparisonServices = [],
  onRemoveService,
  onClearAll,
  className = ''
}) => {
  const [showChart, setShowChart] = useState(true);

  if (comparisonServices.length === 0) {
    return (
      <div className={`bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 ${className}`}>
        <div className="text-center">
          <Plus className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No Services Selected for Comparison
          </h3>
          <p className="text-white/60">
            Click the compare button on service cards to add them here
          </p>
        </div>
      </div>
    );
  }

  // Find cheapest and most expensive services
  const cheapestService = comparisonServices.reduce((min, service) =>
    service.price_usd < min.price_usd ? service : min
  , comparisonServices[0]);

  const mostExpensiveService = comparisonServices.reduce((max, service) =>
    service.price_usd > max.price_usd ? service : max
  , comparisonServices[0]);

  // Calculate price differences
  const servicesWithDiff = comparisonServices.map(service => {
    const priceDiff = service.price_usd - cheapestService.price_usd;
    const priceDiffPct = cheapestService.price_usd > 0
      ? (priceDiff / cheapestService.price_usd * 100)
      : 0;

    return {
      ...service,
      priceDiff,
      priceDiffPct,
      isCheapest: service === cheapestService
    };
  });

  const exportComparison = () => {
    const csv = [
      ['Provider', 'Service', 'Price (USD)', 'Unit', 'Tier', 'vCPU', 'Memory (GB)', 'Price Difference', 'Difference %'].join(','),
      ...servicesWithDiff.map(s => [
        s.provider,
        s.service_name,
        s.price_usd,
        s.unit,
        s.tier_label,
        s.vcpu || 'N/A',
        s.memory_gb || 'N/A',
        s.priceDiff.toFixed(4),
        s.priceDiffPct.toFixed(2) + '%'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `service-comparison-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-1">
            Service Comparison
          </h3>
          <p className="text-sm text-white/60">
            {comparisonServices.length} services selected
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowChart(!showChart)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
          >
            {showChart ? 'Hide' : 'Show'} Chart
          </button>
          <button
            onClick={exportComparison}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-200 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={onClearAll}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-200 transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Chart */}
      {showChart && (
        <div className="mb-6">
          <ComparisonChart services={servicesWithDiff} />
        </div>
      )}

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">Service</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-white/80">Provider</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-white/80">Price</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-white/80">Difference</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">vCPU</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Memory</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Tier</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-white/80">Action</th>
            </tr>
          </thead>
          <tbody>
            {servicesWithDiff.map((service, index) => (
              <tr
                key={index}
                className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                  service.isCheapest ? 'bg-green-500/10' : ''
                }`}
              >
                {/* Service Name */}
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    {service.isCheapest && (
                      <Award className="w-4 h-4 text-yellow-400" />
                    )}
                    <span className="text-white font-medium">{service.service_name}</span>
                  </div>
                </td>

                {/* Provider */}
                <td className="py-4 px-4">
                  <span className="text-white/80 uppercase text-sm">{service.provider}</span>
                </td>

                {/* Price */}
                <td className="py-4 px-4 text-right">
                  <div>
                    <div className="text-white font-semibold">
                      ${service.price_usd.toFixed(4)}
                    </div>
                    <div className="text-xs text-white/60">{service.unit}</div>
                  </div>
                </td>

                {/* Price Difference */}
                <td className="py-4 px-4 text-right">
                  {service.isCheapest ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200 text-sm">
                      <Award className="w-3 h-3" />
                      Cheapest
                    </span>
                  ) : (
                    <div>
                      <div className="text-red-300 font-medium">
                        +${service.priceDiff.toFixed(4)}
                      </div>
                      <div className="text-xs text-red-400">
                        +{service.priceDiffPct.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </td>

                {/* vCPU */}
                <td className="py-4 px-4 text-center text-white/80">
                  {service.vcpu || '-'}
                </td>

                {/* Memory */}
                <td className="py-4 px-4 text-center text-white/80">
                  {service.memory_gb ? `${service.memory_gb} GB` : '-'}
                </td>

                {/* Tier */}
                <td className="py-4 px-4 text-center">
                  <span className="px-2 py-1 bg-white/10 rounded-lg text-xs text-white/80">
                    {service.tier_label}
                  </span>
                </td>

                {/* Remove Button */}
                <td className="py-4 px-4 text-center">
                  <button
                    onClick={() => onRemoveService(index)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                    title="Remove from comparison"
                  >
                    <X className="w-4 h-4 text-white/60 hover:text-red-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cheapest Option */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-green-400" />
            <span className="text-sm font-semibold text-green-200">Cheapest Option</span>
          </div>
          <div className="text-white font-semibold">{cheapestService.service_name}</div>
          <div className="text-sm text-white/60">{cheapestService.provider.toUpperCase()}</div>
          <div className="text-lg font-bold text-green-300 mt-2">
            ${cheapestService.price_usd.toFixed(4)}
          </div>
        </div>

        {/* Most Expensive */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span className="text-sm font-semibold text-red-200">Most Expensive</span>
          </div>
          <div className="text-white font-semibold">
            {mostExpensiveService.service_name}
          </div>
          <div className="text-sm text-white/60">
            {mostExpensiveService.provider.toUpperCase()}
          </div>
          <div className="text-lg font-bold text-red-300 mt-2">
            ${mostExpensiveService.price_usd.toFixed(4)}
          </div>
        </div>

        {/* Potential Savings */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-blue-200">Max Savings</span>
          </div>
          <div className="text-white font-semibold">vs Most Expensive</div>
          <div className="text-sm text-white/60">By choosing cheapest</div>
          <div className="text-lg font-bold text-blue-300 mt-2">
            {((mostExpensiveService.price_usd - cheapestService.price_usd) / cheapestService.price_usd * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonPanel;
