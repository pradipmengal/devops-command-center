/**
 * OptimizationPanel Component - Task 13.2
 * Panel displaying all AI optimization suggestions.
 */

import React, { useState, useEffect } from 'react';
import { Zap, Loader, RefreshCw, TrendingDown, Filter } from 'lucide-react';
import OptimizationCard from './OptimizationCard';

const OptimizationPanel = ({
  selectedProviders = [],
  selectedCategories = [],
  autoAnalyze = false,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('savings');
  const [analyzed, setAnalyzed] = useState(false);

  // Auto-analyze when providers change (debounced)
  useEffect(() => {
    if (autoAnalyze && selectedProviders.length > 0) {
      const timer = setTimeout(() => analyze(), 1500);
      return () => clearTimeout(timer);
    }
  }, [selectedProviders, autoAnalyze]);

  const analyze = async () => {
    if (selectedProviders.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/optimization/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: selectedProviders,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setSuggestions(data.data.suggestions || []);
        setAnalyzed(true);
      } else {
        setError(data.message || 'Analysis failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (id) => setDismissed(prev => new Set([...prev, id]));
  const handleImplemented = (id) => setDismissed(prev => new Set([...prev, id]));

  const visibleSuggestions = suggestions
    .filter(s => !dismissed.has(s.suggestion_id))
    .filter(s => filterCategory === 'all' || s.category === filterCategory)
    .sort((a, b) => sortBy === 'savings' ? b.savings_amount - a.savings_amount : b.confidence_score - a.confidence_score);

  const categories = ['all', ...new Set(suggestions.map(s => s.category))];
  const totalSavings = visibleSuggestions.reduce((sum, s) => sum + s.savings_amount, 0);

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          <h3 className="text-xl font-semibold text-white">AI Optimization</h3>
          {visibleSuggestions.length > 0 && (
            <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded-full text-xs text-yellow-200">
              {visibleSuggestions.length}
            </span>
          )}
        </div>
        <button
          onClick={analyze}
          disabled={loading || selectedProviders.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-200 text-sm transition-colors disabled:opacity-50"
        >
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {/* Total savings banner */}
      {totalSavings > 0 && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-400" />
            <span className="text-green-200 font-medium">Total potential savings</span>
          </div>
          <div className="text-right">
            <div className="text-green-300 font-bold text-lg">${totalSavings.toFixed(0)}/mo</div>
            <div className="text-green-400/70 text-xs">${(totalSavings * 12).toFixed(0)}/year</div>
          </div>
        </div>
      )}

      {/* Filters */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1 text-sm text-white/60">
            <Filter className="w-3 h-3" />
          </div>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs transition-colors capitalize ${
                filterCategory === cat
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="ml-auto px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-xs focus:outline-none"
          >
            <option value="savings">Sort: Savings</option>
            <option value="confidence">Sort: Confidence</option>
          </select>
        </div>
      )}

      {/* Content */}
      {!analyzed && !loading && (
        <div className="text-center py-12">
          <Zap className="w-12 h-12 text-yellow-400/40 mx-auto mb-3" />
          <p className="text-white/60">
            {selectedProviders.length === 0
              ? 'Select providers to enable optimization analysis'
              : 'Click "Analyze" to get AI-powered cost optimization suggestions'}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-yellow-400 animate-spin" />
          <span className="ml-3 text-white/80">Analyzing your cloud costs...</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {analyzed && !loading && visibleSuggestions.length === 0 && (
        <div className="text-center py-8">
          <p className="text-white/60">No optimization suggestions found for current selection.</p>
        </div>
      )}

      {/* Suggestion Cards */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {visibleSuggestions.map(suggestion => (
          <OptimizationCard
            key={suggestion.suggestion_id}
            suggestion={suggestion}
            onDismiss={handleDismiss}
            onImplemented={handleImplemented}
          />
        ))}
      </div>
    </div>
  );
};

export default OptimizationPanel;
