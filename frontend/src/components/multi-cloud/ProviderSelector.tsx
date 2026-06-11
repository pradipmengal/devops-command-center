/**
 * ProviderSelector Component
 * 
 * Dynamic multi-select provider selector with health status indicators.
 * Falls back to static provider list if API is unavailable.
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react';

// Static fallback providers — always shown even if API is down
const STATIC_PROVIDERS = [
  {
    provider_id: 'aws',
    provider_name: 'Amazon Web Services',
    api_version: '1.0',
    rate_limit: 10,
    enabled: true
  },
  {
    provider_id: 'azure',
    provider_name: 'Microsoft Azure',
    api_version: '1.0',
    rate_limit: 20,
    enabled: true
  },
  {
    provider_id: 'gcp',
    provider_name: 'Google Cloud Platform',
    api_version: '1.0',
    rate_limit: 15,
    enabled: true
  },
  {
    provider_id: 'tata_cloud',
    provider_name: 'Tata Cloud',
    api_version: '1.0',
    rate_limit: 5,
    enabled: true
  },
  {
    provider_id: 'jio_cloud',
    provider_name: 'Jio Cloud',
    api_version: '1.0',
    rate_limit: 5,
    enabled: true
  },
  {
    provider_id: 'yotta',
    provider_name: 'Yotta Infrastructure',
    api_version: '1.0',
    rate_limit: 5,
    enabled: true
  },
  {
    provider_id: 'nxtgen',
    provider_name: 'NxtGen Data Centers',
    api_version: '1.0',
    rate_limit: 5,
    enabled: true
  }
];

const PROVIDER_LOGOS = {
  aws: '☁️',
  azure: '🔷',
  gcp: '🌐',
  oci: '🔶',
  digitalocean: '🌊',
  alibaba: '🐘',
  tata_cloud: '🟣',
  jio_cloud: '🟢',
  yotta: '🟠',
  nxtgen: '🔵'
};

const PROVIDER_COLORS = {
  aws: 'from-orange-500 to-orange-600',
  azure: 'from-blue-500 to-blue-600',
  gcp: 'from-red-500 to-red-600',
  oci: 'from-red-600 to-orange-600',
  digitalocean: 'from-blue-400 to-blue-500',
  alibaba: 'from-orange-400 to-orange-500',
  tata_cloud: 'from-purple-500 to-purple-700',
  jio_cloud: 'from-green-500 to-green-700',
  yotta: 'from-amber-500 to-amber-700',
  nxtgen: 'from-cyan-500 to-cyan-700'
};

const ProviderSelector = ({
  selectedProviders = [],
  onProviderToggle,
  className = ''
}) => {
  const [providers, setProviders] = useState(STATIC_PROVIDERS);
  const [healthStatus, setHealthStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    fetchProviders();
    fetchHealthStatus();
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/providers', { signal: controller.signal });
      clearTimeout(timeout);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      if (data.status === 'success' && data.data.providers?.length > 0) {
        // Merge API providers with static fallback so Indian providers are always present
        const apiIds = new Set(data.data.providers.map(p => p.provider_id));
        const merged = [...data.data.providers];
        STATIC_PROVIDERS.forEach(sp => {
          if (!apiIds.has(sp.provider_id)) {
            merged.push(sp);
          }
        });
        setProviders(merged);
      }
      // If API returns empty, keep static fallback
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Provider API unavailable, using static list:', err.message);
        setApiError('Using offline provider list');
      }
      // Keep static fallback providers — don't clear them
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health/providers', { signal: controller.signal });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.status === 'success') {
        setHealthStatus(data.data);
      }
    } catch (err) {
      // Health check is optional — silently ignore errors
    }
  };

  const getHealthIcon = (providerId) => {
    const health = healthStatus[providerId];
    if (!health) return <div className="w-2 h-2 rounded-full bg-gray-500" />;
    
    switch (health.status) {
      case 'healthy':
        return <div className="w-2 h-2 rounded-full bg-green-400" />;
      case 'degraded':
        return <div className="w-2 h-2 rounded-full bg-yellow-400" />;
      case 'unavailable':
        return <div className="w-2 h-2 rounded-full bg-red-400" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-500" />;
    }
  };

  const handleSelectAll = () => {
    providers
      .filter(p => p.enabled && !selectedProviders.includes(p.provider_id))
      .forEach(p => onProviderToggle(p.provider_id));
  };

  const handleDeselectAll = () => {
    selectedProviders.forEach(id => onProviderToggle(id));
  };

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">
          Cloud Providers
        </h3>
        <div className="flex items-center gap-2">
          {loading && <Loader className="w-4 h-4 text-blue-400 animate-spin" />}
          <span className="text-xs text-white/50">
            {selectedProviders.length}/{providers.length}
          </span>
          <button
            onClick={fetchProviders}
            className="p-1 text-white/40 hover:text-white/80 transition-colors"
            title="Refresh providers"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* API warning (non-blocking) */}
      {apiError && (
        <div className="mb-3 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-xs text-yellow-300">{apiError}</p>
        </div>
      )}

      {/* Provider Cards */}
      <div className="space-y-2">
        {providers.map((provider) => {
          const isSelected = selectedProviders.includes(provider.provider_id);
          const isEnabled = provider.enabled !== false;

          return (
            <button
              key={provider.provider_id}
              onClick={() => isEnabled && onProviderToggle(provider.provider_id)}
              disabled={!isEnabled}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} ${provider.provider_name}`}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 text-left
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isSelected
                  ? `bg-gradient-to-r ${PROVIDER_COLORS[provider.provider_id] || 'from-gray-500 to-gray-600'} border-white/30 shadow-lg`
                  : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
                }
                ${!isEnabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Logo */}
              <span className="text-2xl flex-shrink-0">
                {PROVIDER_LOGOS[provider.provider_id] || '☁️'}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm truncate">
                  {provider.provider_name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {getHealthIcon(provider.provider_id)}
                  <span className="text-white/50 text-xs">
                    {healthStatus[provider.provider_id]?.status || 'ready'}
                  </span>
                </div>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <CheckCircle className="w-5 h-5 text-white flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
        <button
          onClick={handleSelectAll}
          className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-colors"
        >
          Select All
        </button>
        <button
          onClick={handleDeselectAll}
          disabled={selectedProviders.length === 0}
          className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg text-white text-xs transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Hint */}
      {selectedProviders.length === 0 && (
        <p className="mt-3 text-xs text-yellow-300/80 text-center">
          Select a provider to view services
        </p>
      )}
    </div>
  );
};

export default ProviderSelector;
