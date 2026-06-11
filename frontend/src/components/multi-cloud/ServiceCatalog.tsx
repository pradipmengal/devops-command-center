/**
 * ServiceCatalog Component
 * 
 * Main service catalog display with virtual scrolling for performance.
 * Shows services from selected providers with filtering and sorting.
 * 
 * Requirements:
 *   - Requirement 8.1: Service catalog display
 *   - Requirement 8.2: Virtual scrolling for performance
 *   - Requirement 8.3: Sorting and filtering
 * 
 * Features:
 *   - Virtual scrolling for large datasets
 *   - Grid/List view toggle
 *   - Sort by price, name, provider
 *   - Loading states
 *   - Empty states
 */

import React, { useState, useEffect, useRef } from 'react';
import { Grid, List, ArrowUpDown, Loader, AlertCircle } from 'lucide-react';
import ServiceCard from './ServiceCard';

const ServiceCatalog = ({
  selectedProviders = [],
  selectedRegions = [],
  selectedCategories = [],
  searchTerm = '',
  className = '',
  onServicesLoaded,
  onAddToCompare,
  isInComparison,
}) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('price'); // 'price', 'name', 'provider'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const observerTarget = useRef(null);
  const servicesRef = useRef([]);
  const abortRef = useRef(null);

  // Debounce search term to avoid flooding API
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch services when filters change
  useEffect(() => {
    if (selectedProviders.length > 0) {
      fetchServices(true);
    } else {
      servicesRef.current = [];
      setServices([]);
      onServicesLoaded?.([]);
    }
  }, [selectedProviders, selectedRegions, selectedCategories, debouncedSearch]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, page]);

  const fetchServices = async (reset = false, pageOverride) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      setLoading(true);
      setError(null);

      const currentPage = pageOverride ?? (reset ? 1 : page);
      
      const params = new URLSearchParams({
        providers: selectedProviders.join(','),
        page: currentPage,
        page_size: 50
      });

      if (selectedRegions.length > 0) {
        params.append('regions', selectedRegions.join(','));
      }

      if (selectedCategories.length > 0) {
        params.append('categories', selectedCategories.join(','));
      }

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await fetch(`/api/services/search?${params}`, { signal });
      const data = await response.json();

      if (data.status === 'success') {
        const newServices = data.data.services;
        
        if (reset) {
          servicesRef.current = newServices;
          setServices(newServices);
          setPage(1);
        } else {
          servicesRef.current = [...servicesRef.current, ...newServices];
          setServices(servicesRef.current);
        }
        onServicesLoaded?.(servicesRef.current);

        const pagination = data.data.pagination;
        setHasMore(pagination.page < pagination.total_pages);
      } else {
        // Check for provider-not-found errors and show a friendlier message
        const msg = data.message || '';
        if (msg.includes('not found in registry')) {
          const missing = msg.match(/'([^']+)'/)?.[1] || 'provider';
          setError(`Backend does not recognize "${missing}". Restart the backend server to pick up new providers.`);
        } else {
          setError(msg);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(`Error loading services: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchServices(false, nextPage);
  };

  const sortServices = (servicesToSort) => {
    const sorted = [...servicesToSort];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'price':
          comparison = a.price_usd - b.price_usd;
          break;
        case 'name':
          comparison = a.service_name.localeCompare(b.service_name);
          break;
        case 'provider':
          comparison = a.provider.localeCompare(b.provider);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const sortedServices = sortServices(services);

  // Empty state
  if (selectedProviders.length === 0) {
    return (
      <div className={`bg-white/10 backdrop-blur-md rounded-xl p-12 border border-white/20 ${className}`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            No Providers Selected
          </h3>
          <p className="text-white/60">
            Select at least one cloud provider to view services
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-1">
            Service Catalog
          </h3>
          <p className="text-sm text-white/60">
            {sortedServices.length} services found
          </p>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-4">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/60">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-white/40"
            >
              <option value="price">Price</option>
              <option value="name">Name</option>
              <option value="provider">Provider</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              <ArrowUpDown className={`w-4 h-4 text-white ${sortOrder === 'desc' ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-white/20 text-white'
                  : 'text-white/60 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {/* Services Grid/List */}
      {loading && services.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-blue-400 animate-spin" />
          <span className="ml-3 text-white/80">Loading services...</span>
        </div>
      ) : sortedServices.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-white mb-2">
            No Services Found
          </h4>
          <p className="text-white/60">
            Try adjusting your filters or search term
          </p>
        </div>
      ) : (
        <>
          <div className={`
            ${viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-3'
            }
          `}>
            {sortedServices.map((service, index) => (
              <ServiceCard
                key={`${service.provider}-${service.service_name}-${index}`}
                service={service}
                viewMode={viewMode}
                onAddToCompare={onAddToCompare}
                isInComparison={isInComparison ? isInComparison(service) : false}
              />
            ))}
          </div>

          {/* Loading More Indicator */}
          {loading && services.length > 0 && (
            <div className="flex items-center justify-center py-6 mt-6 border-t border-white/10">
              <Loader className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="ml-3 text-white/60">Loading more services...</span>
            </div>
          )}

          {/* Infinite Scroll Trigger */}
          {hasMore && !loading && (
            <div ref={observerTarget} className="h-10" />
          )}

          {/* End of Results */}
          {!hasMore && services.length > 0 && (
            <div className="text-center py-6 mt-6 border-t border-white/10">
              <p className="text-white/60">
                All services loaded ({sortedServices.length} total)
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ServiceCatalog;
