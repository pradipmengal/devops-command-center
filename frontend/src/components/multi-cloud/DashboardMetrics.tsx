/**
 * DashboardMetrics Component - Task 14.3
 * Summary metric cards: total services, avg cost, cheapest provider, potential savings.
 */

import React from 'react';
import { Server, DollarSign, Award, TrendingDown } from 'lucide-react';

const MetricCard = ({ icon: Icon, label, value, sub, color = 'blue' }) => {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
  };
  const iconColors = { blue: 'text-blue-400', green: 'text-green-400', yellow: 'text-yellow-400', purple: 'text-purple-400' };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} backdrop-blur-md rounded-xl p-5 border`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/60 mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-white/50 mt-1">{sub}</p>}
        </div>
        <Icon className={`w-8 h-8 ${iconColors[color]} opacity-80`} />
      </div>
    </div>
  );
};

const DashboardMetrics = ({ services = [], optimizationSuggestions = [], className = '' }) => {
  const totalServices = services.length;

  const avgCost = totalServices > 0
    ? (services.reduce((sum, s) => sum + s.price_usd, 0) / totalServices).toFixed(4)
    : '0.0000';

  // Find cheapest provider by average price
  const providerAvg = {};
  services.forEach(s => {
    if (!providerAvg[s.provider]) providerAvg[s.provider] = { total: 0, count: 0 };
    providerAvg[s.provider].total += s.price_usd;
    providerAvg[s.provider].count += 1;
  });
  const cheapestProvider = Object.entries(providerAvg)
    .map(([p, d]) => ({ provider: p, avg: d.total / d.count }))
    .sort((a, b) => a.avg - b.avg)[0];

  const totalSavings = optimizationSuggestions
    .reduce((sum, s) => sum + (s.savings_amount || 0), 0);

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      <MetricCard
        icon={Server}
        label="Total Services"
        value={totalServices.toLocaleString()}
        sub={`across ${Object.keys(providerAvg).length} providers`}
        color="blue"
      />
      <MetricCard
        icon={DollarSign}
        label="Avg Price"
        value={`$${avgCost}`}
        sub="per unit"
        color="purple"
      />
      <MetricCard
        icon={Award}
        label="Cheapest Provider"
        value={cheapestProvider ? cheapestProvider.provider.toUpperCase() : '—'}
        sub={cheapestProvider ? `avg $${cheapestProvider.avg.toFixed(4)}` : 'Select providers'}
        color="green"
      />
      <MetricCard
        icon={TrendingDown}
        label="Potential Savings"
        value={totalSavings > 0 ? `$${totalSavings.toFixed(0)}/mo` : '—'}
        sub={totalSavings > 0 ? `$${(totalSavings * 12).toFixed(0)}/year` : 'Run analysis'}
        color="yellow"
      />
    </div>
  );
};

export default DashboardMetrics;
