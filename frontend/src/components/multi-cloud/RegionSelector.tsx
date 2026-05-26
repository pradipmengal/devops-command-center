/**
 * RegionSelector Component
 * 
 * Multi-select region filter with provider-specific region grouping.
 * Allows users to filter services by geographic regions.
 * 
 * Requirements:
 *   - Requirement 6.2: Region-based filtering
 *   - Requirement 6.3: Provider-specific region display
 *   - Requirement 6.4: Multi-region selection
 * 
 * Features:
 *   - Grouped by provider
 *   - Multi-select with checkboxes
 *   - Search/filter regions
 *   - Common region shortcuts (US, EU, Asia)
 *   - Responsive design
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Search, Globe, X } from 'lucide-react';

const RegionSelector = ({
  selectedProviders = [],
  selectedRegions = [],
  onRegionToggle,
  className = ''
}) => {
  const [regions, setRegions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch regions for selected providers
  useEffect(() => {
    if (selectedProviders.length > 0) {
      fetchRegions();
    } else {
      setRegions({});
    }
  }, [selectedProviders]);

  const fetchRegions = async () => {
    setLoading(true);
    const regionsByProvider = {};

    try {
      // Fetch regions for each selected provider
      await Promise.all(
        selectedProviders.map(async (providerId) => {
          try {
            const response = await fetch(`/api/providers/${providerId}/regions`);
            const data = await response.json();
            
            if (data.status === 'success') {
              regionsByProvider[providerId] = data.data.regions || [];
            }
          } catch (err) {
            console.error(`Failed to fetch regions for ${providerId}:`, err);
            regionsByProvider[providerId] = [];
          }
        })
      );

      setRegions(regionsByProvider);
    } catch (err) {
      console.error('Failed to fetch regions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter regions based on search term
  const filterRegions = (regionList) => {
    if (!searchTerm) return regionList;
    
    const search = searchTerm.toLowerCase();
    return regionList.filter(region =>
      region.region_id.toLowerCase().includes(search) ||
      region.region_name.toLowerCase().includes(search) ||
      region.location.toLowerCase().includes(search)
    );
  };

  // Quick select by location
  const selectByLocation = (location) => {
    const locationRegions = [];
    
    Object.values(regions).forEach(providerRegions => {
      providerRegions.forEach(region => {
        if (region.location.toLowerCase().includes(location.toLowerCase())) {
          locationRegions.push(region.region_id);
        }
      });
    });

    locationRegions.forEach(regionId => {
      if (!selectedRegions.includes(regionId)) {
        onRegionToggle(regionId);
      }
    });
  };

  const getProviderName = (providerId) => {
    const names = {
      aws: 'AWS',
      azure: 'Azure',
      gcp: 'GCP',
      oci: 'Oracle Cloud',
      digitalocean: 'DigitalOcean',
      alibaba: 'Alibaba Cloud'
    };
    return names[providerId] || providerId.toUpperCase();
  };

  const getLocationIcon = (location) => {
    if (location.toLowerCase().includes('north america') || location.toLowerCase().includes('us')) {
      return '🇺🇸';
    } else if (location.toLowerCase().includes('europe')) {
      return '🇪🇺';
    } else if (location.toLowerCase().includes('asia')) {
      return '🌏';
    } else if (location.toLowerCase().includes('south america')) {
      return '🌎';
    } else if (location.toLowerCase().includes('africa')) {
      return '🌍';
    } else if (location.toLowerCase().includes('australia') || location.toLowerCase().includes('oceania')) {
      return '🇦🇺';
    }
    return '🌐';
  };

  if (selectedProviders.length === 0) {
    return (
      <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
        <div className="flex items-center justify-center py-8 text-white/60">
          <MapPin className="w-5 h-5 mr-2" />
          <span>Select providers first to view regions</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          Select Regions
        </h3>
        <span className="text-sm text-white/60">
          {selectedRegions.length} selected
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search regions..."
          className="w-full pl-10 pr-10 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/80"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Select Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => selectByLocation('North America')}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
        >
          🇺🇸 US Regions
        </button>
        <button
          onClick={() => selectByLocation('Europe')}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
        >
          🇪🇺 EU Regions
        </button>
        <button
          onClick={() => selectByLocation('Asia')}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
        >
          🌏 Asia Regions
        </button>
      </div>

      {/* Regions by Provider */}
      <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-white/60">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            <span className="ml-3">Loading regions...</span>
          </div>
        ) : (
          Object.entries(regions).map(([providerId, providerRegions]) => {
            const filteredRegions = filterRegions(providerRegions);
            
            if (filteredRegions.length === 0) return null;

            return (
              <div key={providerId} className="bg-white/5 rounded-lg p-4">
                {/* Provider Header */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium">
                    {getProviderName(providerId)}
                  </h4>
                  <span className="text-xs text-white/40">
                    {filteredRegions.length} regions
                  </span>
                </div>

                {/* Region List */}
                <div className="space-y-2">
                  {filteredRegions.map((region) => {
                    const isSelected = selectedRegions.includes(region.region_id);
                    
                    return (
                      <label
                        key={region.region_id}
                        className="flex items-center p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onRegionToggle(region.region_id)}
                          className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center">
                            <span className="mr-2">
                              {getLocationIcon(region.location)}
                            </span>
                            <span className="text-white text-sm">
                              {region.region_name}
                            </span>
                          </div>
                          <div className="text-xs text-white/40 mt-0.5">
                            {region.region_id} • {region.location}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Clear Selection */}
      {selectedRegions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <button
            onClick={() => {
              selectedRegions.forEach(regionId => onRegionToggle(regionId));
            }}
            className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
          >
            Clear All Regions
          </button>
        </div>
      )}

      {/* Info Message */}
      {selectedRegions.length === 0 && !loading && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-200">
            <Globe className="w-4 h-4 inline mr-1" />
            No regions selected - showing all regions
          </p>
        </div>
      )}
    </div>
  );
};

export default RegionSelector;
