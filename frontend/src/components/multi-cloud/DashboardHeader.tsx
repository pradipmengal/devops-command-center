/**
 * DashboardHeader Component - Task 14.2
 * Top header with provider selector, search, analyze and export buttons.
 */

import React, { useState, useRef } from 'react';
import { Zap, Download, RefreshCw, Globe, Search } from 'lucide-react';
import ServiceSearch from './ServiceSearch';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'BRL'];

const DashboardHeader = ({
  selectedProviders,
  onSearch,
  onAnalyze,
  onExport,
  onRefresh,
  currency,
  onCurrencyChange,
  isAnalyzing = false,
  className = ''
}) => {
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const searchRef = useRef(null);

  const handleSearchClick = () => {
    if (searchRef.current) {
      searchRef.current.triggerSearch();
    }
  };

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Title */}
        <div className="flex items-center gap-2 mr-2">
          <Globe className="w-6 h-6 text-blue-400" />
          <span className="text-white font-bold text-lg hidden md:block">Multi-Cloud Intelligence</span>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px] flex gap-2">
          <ServiceSearch
            ref={searchRef}
            onSearch={onSearch}
            placeholder="Search services across all providers..."
            className="flex-1"
          />
          <button
            onClick={handleSearchClick}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-200 text-sm transition-colors flex items-center gap-2"
            title="Search services"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:block">Search</span>
          </button>
        </div>

        {/* Currency Selector */}
        <div className="relative">
          <button
            onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-sm transition-colors"
          >
            {currency || 'USD'}
          </button>
          {showCurrencyMenu && (
            <div className="absolute right-0 top-full mt-1 bg-gray-900/95 backdrop-blur border border-white/20 rounded-lg overflow-hidden z-50 shadow-xl">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => { onCurrencyChange?.(c); setShowCurrencyMenu(false); }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition-colors ${
                    currency === c ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 transition-colors"
          title="Refresh service catalog"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Analyze */}
        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || selectedProviders.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm transition-colors disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          <span className="hidden sm:block">Analyze Costs</span>
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-200 text-sm transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:block">Export</span>
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;
