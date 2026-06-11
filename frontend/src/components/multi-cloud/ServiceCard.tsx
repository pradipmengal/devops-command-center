/**
 * ServiceCard Component
 * 
 * Individual service card displaying pricing and specifications.
 * Supports both grid and list view modes.
 * 
 * Requirements:
 *   - Requirement 8.4: Service card display
 *   - Requirement 8.5: Pricing information
 *   - Requirement 8.6: Specifications display
 * 
 * Features:
 *   - Provider branding
 *   - Pricing display with unit
 *   - Specifications (vCPU, memory, etc.)
 *   - Tier badges
 *   - Responsive layout
 *   - Hover effects
 *   - Dynamic OS and Storage selection for Compute instances
 */

import React, { useState, useMemo } from 'react';
import { Server, HardDrive, Cpu, MemoryStick, DollarSign, MapPin, Tag, Info, GitCompare, CheckCircle } from 'lucide-react';

const ServiceCard = ({ service, viewMode = 'grid', onAddToCompare, isInComparison = false }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // OS and Storage state for Compute instances
  const isCompute = service.category?.toLowerCase().includes('compute') || service.category?.toLowerCase().includes('vm');
  const [selectedOs, setSelectedOs] = useState('Linux');
  const [storageGb, setStorageGb] = useState(0);

  const getProviderColor = (provider) => {
    const colors = {
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
    return colors[provider] || 'from-gray-500 to-gray-600';
  };

  const getProviderLogo = (provider) => {
    const logos = {
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
    return logos[provider] || '☁️';
  };

  const getTierColor = (tier) => {
    const colors = {
      'On-Demand': 'bg-blue-500/20 text-blue-200 border-blue-500/30',
      'Reserved': 'bg-green-500/20 text-green-200 border-green-500/30',
      'Spot': 'bg-purple-500/20 text-purple-200 border-purple-500/30',
      'Savings Plan': 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30',
      'Committed Use': 'bg-green-500/20 text-green-200 border-green-500/30',
      'Preemptible': 'bg-purple-500/20 text-purple-200 border-purple-500/30'
    };
    return colors[tier] || 'bg-gray-500/20 text-gray-200 border-gray-500/30';
  };

  const formatPrice = (price) => {
    if (price < 0.01) {
      return price.toFixed(6);
    } else if (price < 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(2);
    }
  };

  // Calculate dynamic pricing based on OS and Storage
  const calculatedPricing = useMemo(() => {
    const basePrice = service.price_usd;
    const unit = service.unit.toLowerCase();
    
    // OS Multipliers (approximate for estimation)
    const osMultipliers = {
      'Linux': 1.0,
      'Windows': 1.4,
      'RHEL': 1.2
    };
    const multiplier = osMultipliers[selectedOs] || 1.0;
    
    // Storage cost: ~$0.08 per GB/month for standard SSD (gp3)
    const storagePricePerGbMonth = 0.08;
    const monthlyStorageCost = storageGb * storagePricePerGbMonth;
    
    let hourlyPrice = basePrice * multiplier;
    let monthlyPrice = null;
    
    if (unit.includes('hour')) {
      monthlyPrice = (hourlyPrice * 730) + monthlyStorageCost; // Average hours per month
    } else if (unit.includes('month')) {
      monthlyPrice = (basePrice * multiplier) + monthlyStorageCost;
      hourlyPrice = monthlyPrice / 730;
    }
    
    return { hourlyPrice, monthlyPrice };
  }, [service.price_usd, service.unit, selectedOs, storageGb]);

  const renderConfigOptions = () => {
    if (!isCompute) return null;

    return (
      <div className="space-y-3 mb-4 pb-4 border-b border-white/10">
        {/* OS Selection */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 flex items-center gap-1">
            <Server className="w-3 h-3" />
            OS
          </span>
          <select
            value={selectedOs}
            onChange={(e) => setSelectedOs(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400/50"
          >
            <option value="Linux">Linux</option>
            <option value="Windows">Windows</option>
            <option value="RHEL">RHEL</option>
          </select>
        </div>

        {/* Storage Selection */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60 flex items-center gap-1">
            <HardDrive className="w-3 h-3" />
            Storage
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="10000"
              value={storageGb}
              onChange={(e) => setStorageGb(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400/50 text-right"
            />
            <span className="text-white/60 text-xs">GB</span>
          </div>
        </div>
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-white/5 hover:bg-white/10 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all">
        <div className="flex items-center justify-between">
          {/* Left: Service Info */}
          <div className="flex items-center gap-4 flex-1">
            {/* Provider Badge */}
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getProviderColor(service.provider)} flex items-center justify-center text-2xl`}>
              {getProviderLogo(service.provider)}
            </div>

            {/* Service Details */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-white font-medium">{service.service_name}</h4>
                <span className={`px-2 py-0.5 rounded-full text-xs border ${getTierColor(service.tier_label)}`}>
                  {service.tier_label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-white/60 flex-wrap">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {service.category}
                </span>
                {service.region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {service.region}
                  </span>
                )}
                {service.vcpu && (
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    {service.vcpu} vCPU
                  </span>
                )}
                {service.memory_gb && (
                  <span className="flex items-center gap-1">
                    <MemoryStick className="w-3 h-3" />
                    {service.memory_gb} GB RAM
                  </span>
                )}
              </div>
              
              {/* Inline Config Options for List View */}
              {isCompute && (
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <select
                    value={selectedOs}
                    onChange={(e) => setSelectedOs(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400/50"
                  >
                    <option value="Linux">Linux</option>
                    <option value="Windows">Windows</option>
                    <option value="RHEL">RHEL</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-white/60" />
                    <input
                      type="number"
                      min="0"
                      value={storageGb}
                      onChange={(e) => setStorageGb(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-14 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-400/50 text-right"
                    />
                    <span className="text-white/60 text-xs">GB</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Pricing */}
          <div className="text-right">
            <div className="text-2xl font-bold text-white mb-1">
              ${formatPrice(calculatedPricing.hourlyPrice)}
            </div>
            <div className="text-xs text-white/60">{service.unit}</div>
            {calculatedPricing.monthlyPrice && (
              <div className="text-sm text-blue-300 mt-1">
                ~${calculatedPricing.monthlyPrice.toFixed(2)}/mo
              </div>
            )}
          </div>

          {/* Compare button (list mode) */}
          {onAddToCompare && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCompare(service); }}
              aria-label={isInComparison ? 'Remove from comparison' : 'Add to comparison'}
              className={`ml-3 flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isInComparison
                  ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                  : 'bg-white/10 hover:bg-blue-500/20 border border-white/20 hover:border-blue-500/30 text-white/70 hover:text-blue-300'
              }`}
            >
              {isInComparison
                ? <><CheckCircle className="w-3 h-3" /> Added</>
                : <><GitCompare className="w-3 h-3" /> Compare</>
              }
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div className="bg-white/5 hover:bg-white/10 rounded-lg p-5 border border-white/10 hover:border-white/20 transition-all flex flex-col h-full">
      {/* Provider Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getProviderColor(service.provider)} flex items-center justify-center text-xl`}>
          {getProviderLogo(service.provider)}
        </div>
        <span className={`px-2 py-1 rounded-full text-xs border ${getTierColor(service.tier_label)}`}>
          {service.tier_label}
        </span>
      </div>

      {/* Service Name */}
      <h4 className="text-white font-semibold mb-2 line-clamp-2 min-h-[3rem]">
        {service.service_name}
      </h4>

      {/* Category */}
      <div className="flex items-center gap-1 text-sm text-white/60 mb-4">
        <Tag className="w-3 h-3" />
        <span className="truncate">{service.category}</span>
      </div>

      {/* Dynamic Config Options for Compute */}
      {renderConfigOptions()}

      {/* Static Specifications (if not compute, or additional specs) */}
      {!isCompute && (service.vcpu || service.memory_gb || service.storage_gb) && (
        <div className="space-y-2 mb-4 pb-4 border-b border-white/10">
          {service.vcpu && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                vCPU
              </span>
              <span className="text-white font-medium">{service.vcpu}</span>
            </div>
          )}
          {service.memory_gb && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60 flex items-center gap-1">
                <MemoryStick className="w-3 h-3" />
                Memory
              </span>
              <span className="text-white font-medium">{service.memory_gb} GB</span>
            </div>
          )}
          {service.storage_gb && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60 flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                Storage
              </span>
              <span className="text-white font-medium">{service.storage_gb} GB</span>
            </div>
          )}
        </div>
      )}

      {/* Region */}
      {service.region && (
        <div className="flex items-center gap-1 text-xs text-white/60 mb-4">
          <MapPin className="w-3 h-3" />
          <span>{service.region}</span>
        </div>
      )}

      {/* Pricing */}
      <div className="mt-auto">
        <div className="flex items-baseline gap-1 mb-1">
          <DollarSign className="w-4 h-4 text-white/60" />
          <span className="text-2xl font-bold text-white">
            {formatPrice(calculatedPricing.hourlyPrice)}
          </span>
        </div>
        <div className="text-xs text-white/60 mb-2">{service.unit}</div>
        
        {calculatedPricing.monthlyPrice && (
          <div className="text-sm text-blue-300 font-medium">
            ~${calculatedPricing.monthlyPrice.toFixed(2)}/month
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
        {onAddToCompare && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCompare(service); }}
            className={`flex-1 min-w-0 px-2 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              isInComparison
                ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                : 'bg-white/10 hover:bg-blue-500/20 border border-white/20 hover:border-blue-500/30 text-white/70 hover:text-blue-300'
            }`}
          >
            {isInComparison
              ? <><CheckCircle className="w-4 h-4 shrink-0" /><span className="truncate">Added</span></>
              : <><GitCompare className="w-4 h-4 shrink-0" /><span className="truncate">Compare</span></>
            }
          </button>
        )}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`${onAddToCompare ? 'flex-1 min-w-0' : 'w-full'} px-2 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors flex items-center justify-center gap-1.5`}
        >
          <Info className="w-4 h-4 shrink-0" />
          <span className="truncate">{showDetails ? 'Hide Details' : 'Details'}</span>
        </button>
      </div>

      {/* Expanded Details */}
      {showDetails && service.metadata && Object.keys(service.metadata).length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
          <div className="text-xs font-semibold text-white/80 mb-2">Additional Details:</div>
          {Object.entries(service.metadata).slice(0, 5).map(([key, value]) => (
            <div key={key} className="flex justify-between text-xs">
              <span className="text-white/60 capitalize">{key.replace(/_/g, ' ')}:</span>
              <span className="text-white">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default React.memo(ServiceCard);