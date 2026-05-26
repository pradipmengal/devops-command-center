/**
 * ServiceSearch Component
 * 
 * Advanced search with autocomplete and recent searches.
 * Provides instant search across all services.
 * 
 * Requirements:
 *   - Requirement 6.8: Service search functionality
 *   - Requirement 6.9: Autocomplete suggestions
 *   - Requirement 6.10: Search history
 * 
 * Features:
 *   - Real-time search with debouncing
 *   - Autocomplete dropdown
 *   - Recent searches
 *   - Search suggestions
 *   - Keyboard navigation
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Search, X, Clock, TrendingUp, Loader } from 'lucide-react';

const ServiceSearch = forwardRef(({
  onSearch,
  placeholder = 'Search services...',
  className = ''
}, ref) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);

  useImperativeHandle(ref, () => ({
    getValue: () => searchTerm,
    triggerSearch: () => {
      if (searchTerm.trim()) {
        handleSearch(searchTerm);
      }
    }
  }));

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentServiceSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load recent searches:', e);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTerm.length >= 2) {
      setLoading(true);
      
      // Clear previous timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new timer
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(searchTerm);
      }, 300);
    } else {
      setSuggestions([]);
      setLoading(false);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchTerm]);

  const fetchSuggestions = async (term) => {
    try {
      // Fetch suggestions from API
      const response = await fetch(`/api/services/search?search=${encodeURIComponent(term)}&page_size=10`);
      const data = await response.json();

      if (data.status === 'success') {
        // Extract unique service names and categories
        const serviceNames = [...new Set(data.data.services.map(s => s.service_name))].slice(0, 5);
        const categories = [...new Set(data.data.services.map(s => s.category))].slice(0, 3);
        
        setSuggestions({
          services: serviceNames,
          categories: categories
        });
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term) => {
    if (term.trim()) {
      // Add to recent searches
      const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('recentServiceSearches', JSON.stringify(updated));
      
      // Trigger search
      onSearch(term);
      setShowDropdown(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(true);
    setSelectedIndex(-1);
    
    // Trigger search immediately for empty string
    if (value === '') {
      onSearch('');
    }
  };

  const handleKeyDown = (e) => {
    const allItems = [
      ...(suggestions.services || []),
      ...(suggestions.categories || []),
      ...recentSearches
    ];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < allItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && allItems[selectedIndex]) {
        setSearchTerm(allItems[selectedIndex]);
        handleSearch(allItems[selectedIndex]);
      } else {
        handleSearch(searchTerm);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    handleSearch(suggestion);
  };

  const clearSearch = () => {
    setSearchTerm('');
    onSearch('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentServiceSearches');
  };

  const showSuggestions = suggestions.services?.length > 0 || suggestions.categories?.length > 0;
  const showRecent = recentSearches.length > 0 && searchTerm.length === 0;

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/40 transition-colors"
        />
        
        {/* Loading/Clear Button */}
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <Loader className="w-5 h-5 text-white/40 animate-spin" />
          ) : searchTerm && (
            <button
              onClick={clearSearch}
              className="text-white/40 hover:text-white/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (showSuggestions || showRecent) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden z-50 shadow-2xl"
        >
          {/* Service Suggestions */}
          {suggestions.services?.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-white/60 flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Services
              </div>
              {suggestions.services.map((service, index) => (
                <button
                  key={`service-${index}`}
                  onClick={() => handleSuggestionClick(service)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-colors ${
                    selectedIndex === index ? 'bg-white/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-white/40" />
                    <span className="truncate">{service}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Category Suggestions */}
          {suggestions.categories?.length > 0 && (
            <div className="p-2 border-t border-white/10">
              <div className="px-3 py-2 text-xs font-semibold text-white/60">
                Categories
              </div>
              {suggestions.categories.map((category, index) => {
                const adjustedIndex = (suggestions.services?.length || 0) + index;
                return (
                  <button
                    key={`category-${index}`}
                    onClick={() => handleSuggestionClick(category)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-colors ${
                      selectedIndex === adjustedIndex ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-blue-400">#</span>
                      <span className="truncate">{category}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent Searches */}
          {showRecent && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-white/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Recent Searches
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="text-white/40 hover:text-white/80 transition-colors"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => {
                const adjustedIndex = (suggestions.services?.length || 0) + (suggestions.categories?.length || 0) + index;
                return (
                  <button
                    key={`recent-${index}`}
                    onClick={() => handleSuggestionClick(search)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-colors ${
                      selectedIndex === adjustedIndex ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-white/40" />
                      <span className="truncate">{search}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ServiceSearch;
