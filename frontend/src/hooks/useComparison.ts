/**
 * useComparison Hook
 * 
 * State management for service comparison.
 * Manages adding/removing services from comparison.
 * 
 * Requirements:
 *   - Requirement 9.6: Comparison state management
 *   - Requirement 9.7: Persistent comparison state
 * 
 * Features:
 *   - Add/remove services
 *   - Clear all
 *   - Persist to localStorage
 *   - Max comparison limit
 */

import { useState, useEffect } from 'react';

const MAX_COMPARISON_ITEMS = 10;
const STORAGE_KEY = 'multicloud_comparison_services';

export const useComparison = () => {
  const [comparisonServices, setComparisonServices] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setComparisonServices(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load comparison state:', error);
    }
  }, []);

  // Save to localStorage whenever comparison changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(comparisonServices));
    } catch (error) {
      console.error('Failed to save comparison state:', error);
    }
  }, [comparisonServices]);

  const addToComparison = (service) => {
    if (comparisonServices.length >= MAX_COMPARISON_ITEMS) {
      return {
        success: false,
        message: `Maximum ${MAX_COMPARISON_ITEMS} services can be compared at once`
      };
    }

    // Check if already in comparison
    const exists = comparisonServices.some(
      s => s.provider === service.provider && s.service_name === service.service_name
    );

    if (exists) {
      return {
        success: false,
        message: 'Service already in comparison'
      };
    }

    setComparisonServices(prev => [...prev, service]);
    return {
      success: true,
      message: 'Service added to comparison'
    };
  };

  const removeFromComparison = (index) => {
    setComparisonServices(prev => prev.filter((_, i) => i !== index));
  };

  const clearComparison = () => {
    setComparisonServices([]);
  };

  const isInComparison = (service) => {
    return comparisonServices.some(
      s => s.provider === service.provider && s.service_name === service.service_name
    );
  };

  return {
    comparisonServices,
    addToComparison,
    removeFromComparison,
    clearComparison,
    isInComparison,
    canAddMore: comparisonServices.length < MAX_COMPARISON_ITEMS
  };
};

export default useComparison;
