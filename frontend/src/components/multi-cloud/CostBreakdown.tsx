/**
 * CostBreakdown Component - Task 11.2
 * Pie chart and table showing cost distribution.
 */

import React, { useState } from 'react';
import { PieChart, Table } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

const CostBreakdown = ({ result, duration = 'monthly', className = '' }) => {
  const [view, setView] = useState('chart');

  if (!result) return null;

  const { by_provider, by_category, totals } = result;
  const totalMonthly = totals?.monthly || 0;

  // Build chart data from providers
  const providerData = Object.entries(by_provider || {}).map(([provider, data], i) => ({
    label: provider.toUpperCase(),
    value: data.monthly_cost,
    color: COLORS[i % COLORS.length],
    percentage: totalMonthly > 0 ? (data.monthly_cost / totalMonthly * 100).toFixed(1) : 0
  }));

  const categoryData = Object.entries(by_category || {}).map(([cat, data], i) => ({
    label: cat,
    value: data.monthly_cost,
    color: COLORS[i % COLORS.length],
    percentage: totalMonthly > 0 ? (data.monthly_cost / totalMonthly * 100).toFixed(1) : 0
  }));

  const durationKey = duration === 'annual' ? 'annual' : duration === 'daily' ? 'daily' : duration === 'hourly' ? 'hourly' : 'monthly';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold">Cost Breakdown</h4>
        <div className="flex bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setView('chart')}
            className={`p-1.5 rounded transition-colors ${view === 'chart' ? 'bg-white/20 text-white' : 'text-white/60'}`}
          >
            <PieChart className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView('table')}
            className={`p-1.5 rounded transition-colors ${view === 'table' ? 'bg-white/20 text-white' : 'text-white/60'}`}
          >
            <Table className="w-4 h-4" />
          </button>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* By Provider */}
          <div className="bg-white/5 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-white/80 mb-3">By Provider</h5>
            <div className="space-y-2">
              {providerData.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{item.label}</span>
                    <span className="text-white/80">${item.value.toFixed(2)}/mo ({item.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By Category */}
          <div className="bg-white/5 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-white/80 mb-3">By Category</h5>
            <div className="space-y-2">
              {categoryData.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white truncate mr-2">{item.label}</span>
                    <span className="text-white/80 whitespace-nowrap">${item.value.toFixed(2)}/mo</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-white/60">Provider</th>
                <th className="text-left py-2 px-3 text-white/60">Service</th>
                <th className="text-right py-2 px-3 text-white/60">Monthly</th>
                <th className="text-right py-2 px-3 text-white/60">Annual</th>
              </tr>
            </thead>
            <tbody>
              {(result.estimates || []).slice(0, 20).map((est, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-3 text-white/80 uppercase">{est.service?.provider}</td>
                  <td className="py-2 px-3 text-white">{est.service?.service_name}</td>
                  <td className="py-2 px-3 text-right text-white">${est.costs?.monthly?.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-white/80">${est.costs?.annual?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/20">
                <td colSpan={2} className="py-2 px-3 text-white font-semibold">Total</td>
                <td className="py-2 px-3 text-right text-white font-bold">${totals?.monthly?.toFixed(2)}</td>
                <td className="py-2 px-3 text-right text-white/80 font-bold">${totals?.annual?.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default CostBreakdown;
