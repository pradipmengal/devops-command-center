import React, { useState, useEffect, useCallback } from 'react';
import { Globe, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import PriceStatusBadge from './PriceStatusBadge';

const PROVIDER_NAMES = { aws: 'AWS', azure: 'Azure', gcp: 'GCP', tata_cloud: 'Tata Cloud', jio_cloud: 'Jio Cloud', yotta: 'Yotta', nxtgen: 'NxtGen' };
const PROVIDER_COLORS = { aws: 'from-orange-500 to-orange-600', azure: 'from-blue-500 to-blue-600', gcp: 'from-red-500 to-red-600', tata_cloud: 'from-purple-500 to-purple-700', jio_cloud: 'from-green-500 to-green-700', yotta: 'from-amber-500 to-amber-700', nxtgen: 'from-cyan-500 to-cyan-700' };
const PROVIDER_LOGOS = { aws: '☁️', azure: '🔷', gcp: '🌐', tata_cloud: '🟣', jio_cloud: '🟢', yotta: '🟠', nxtgen: '🔵' };

const RegionalPriceComparison = ({ selectedProviders = ['aws', 'azure', 'gcp', 'tata_cloud', 'jio_cloud', 'yotta', 'nxtgen'], className = '' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('table');

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cloud-pricing/regional?providers=${selectedProviders.join(',')}`
      );
      const json = await res.json();
      if (json.status === 'success') {
        setData(json.data);
      } else {
        setError(json.message || 'Failed to fetch regional prices');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProviders]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  const allCategories = new Set();
  if (data) {
    Object.values(data).forEach(providerData => {
      if (providerData.prices) {
        Object.values(providerData.prices).forEach(regionData => {
          Object.keys(regionData).forEach(cat => allCategories.add(cat));
        });
      }
    });
  }

  const getProviderStatus = (providerId) => {
    if (!data || !data[providerId]) return 'fallback';
    return data[providerId].overall_status || 'fallback';
  };

  const getAllRegions = () => {
    const regions = new Set();
    if (data) {
      Object.values(data).forEach(providerData => {
        if (providerData.prices) {
          Object.keys(providerData.prices).forEach(r => regions.add(r));
        }
      });
    }
    return Array.from(regions).sort();
  };

  const formatPrice = (price) => {
    if (price == null) return '-';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const regions = getAllRegions();
  const categories = Array.from(allCategories).sort();

  if (loading && !data) {
    return (
      <div className={`bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 ${className}`}>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-white animate-spin mr-3" />
          <span className="text-white/60">Fetching live regional prices...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 ${className}`}>
        <div className="text-center py-8">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 mb-4">{error}</p>
          <button onClick={fetchPrices} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl border border-white/20 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Regional Price Comparison
          </h3>
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white/80 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Provider Status Bar */}
        <div className="flex flex-wrap gap-3">
          {selectedProviders.map(pid => (
            <div key={pid} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
              <span>{PROVIDER_LOGOS[pid]}</span>
              <span className="text-sm text-white font-medium">{PROVIDER_NAMES[pid]}</span>
              <PriceStatusBadge status={getProviderStatus(pid)} size="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 px-6">
        <button
          onClick={() => setActiveTab('table')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'table' ? 'text-blue-300 border-blue-400' : 'text-white/50 border-transparent hover:text-white/80'
          }`}
        >
          Price Table
        </button>
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'heatmap' ? 'text-blue-300 border-blue-400' : 'text-white/50 border-transparent hover:text-white/80'
          }`}
        >
          Heatmap View
        </button>
      </div>

      {/* Table View */}
      {activeTab === 'table' && (
        <div className="p-6 overflow-x-auto">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-white/40">No pricing data available</div>
          ) : (
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat} className="bg-white/5 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <span className="text-white font-medium text-sm">{cat}</span>
                    {expandedCategory === cat ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
                  </button>

                  {expandedCategory === cat && (
                    <div className="px-4 pb-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/50 text-xs">
                            <th className="text-left py-2 pr-4">Region</th>
                            {selectedProviders.map(pid => (
                              <th key={pid} className="text-right px-2 py-2">{PROVIDER_NAMES[pid]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {regions.map(region => {
                            const prices = selectedProviders.map(pid => {
                              const pd = data[pid];
                              if (!pd || !pd.prices || !pd.prices[region]) return null;
                              return pd.prices[region][cat] || null;
                            });
                            const validPrices = prices.filter(p => p && p.price_usd != null);
                            const minPrice = validPrices.length > 0 ? Math.min(...validPrices.map(p => p.price_usd)) : null;

                            return (
                              <tr key={region} className="border-t border-white/5 hover:bg-white/5">
                                <td className="py-2 pr-4 text-white/80 font-medium">{region}</td>
                                {selectedProviders.map((pid, idx) => {
                                  const price = prices[idx];
                                  if (!price) {
                                    return <td key={pid} className="text-right px-2 py-2 text-white/30">-</td>;
                                  }
                                  const isCheapest = minPrice !== null && price.price_usd === minPrice;
                                  return (
                                    <td key={pid} className="text-right px-2 py-2">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {isCheapest && <span className="text-green-400 text-xs font-bold">✓</span>}
                                        <span className={`${isCheapest ? 'text-green-300 font-semibold' : 'text-white/70'}`}>
                                          {formatPrice(price.price_usd)}
                                        </span>
                                        <PriceStatusBadge status={price.price_status} showLabel={false} size="sm" />
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Heatmap View */}
      {activeTab === 'heatmap' && (
        <div className="p-6 overflow-x-auto">
          {categories.map(cat => (
            <div key={cat} className="mb-6 last:mb-0">
              <h4 className="text-white font-medium text-sm mb-3">{cat}</h4>
              <div className="grid gap-2" style={{ gridTemplateColumns: `120px repeat(${selectedProviders.length}, 1fr)` }}>
                <div className="text-xs text-white/40 font-medium px-2">Region</div>
                {selectedProviders.map(pid => (
                  <div key={pid} className="text-xs text-white/40 font-medium text-center px-2">{PROVIDER_NAMES[pid]}</div>
                ))}
                {regions.map(region => (
                  <React.Fragment key={region}>
                    <div className="text-xs text-white/60 px-2 py-1 truncate">{region}</div>
                    {selectedProviders.map(pid => {
                      const pd = data[pid];
                      if (!pd || !pd.prices || !pd.prices[region]) {
                        return <div key={pid} className="text-center text-white/20 text-xs py-1 bg-white/5 rounded">-</div>;
                      }
                      const price = pd.prices[region][cat];
                      if (!price || price.price_usd == null) {
                        return <div key={pid} className="text-center text-white/20 text-xs py-1 bg-white/5 rounded">-</div>;
                      }
                      const intensity = Math.min(1, price.price_usd / 0.5);
                      const r = Math.round(220 - intensity * 180);
                      const g = Math.round(220 - intensity * 120);
                      const b = Math.round(220 - intensity * 80);
                      return (
                        <div
                          key={pid}
                          className="text-center text-xs py-1 rounded flex items-center justify-center gap-1"
                          style={{ backgroundColor: `rgba(${255 - r}, ${255 - g}, ${255 - b}, 0.3)`, color: intensity > 0.6 ? '#fff' : 'rgba(255,255,255,0.8)' }}
                        >
                          <span>{formatPrice(price.price_usd)}</span>
                          <PriceStatusBadge status={price.price_status} showLabel={false} size="sm" />
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="px-6 py-3 border-t border-white/10 flex flex-wrap items-center gap-4">
        <span className="text-xs text-white/40">Legend:</span>
        <PriceStatusBadge status="live" />
        <PriceStatusBadge status="cached" />
        <PriceStatusBadge status="fallback" />
        <span className="text-xs text-white/40 ml-2">
          <span className="text-green-400 font-bold">✓</span> = Cheapest in region
        </span>
      </div>
    </div>
  );
};

export default RegionalPriceComparison;
