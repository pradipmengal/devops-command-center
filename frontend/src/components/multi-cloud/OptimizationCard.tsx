/**
 * OptimizationCard Component - Task 13.1
 * Displays a single AI optimization suggestion.
 */

import React, { useState } from 'react';
import { TrendingDown, ChevronDown, ChevronUp, CheckCircle, X, Zap, Award, ArrowRight } from 'lucide-react';

const CATEGORY_COLORS = {
  'Reserved Instances': 'from-green-500 to-emerald-600',
  'Spot Instances': 'from-purple-500 to-violet-600',
  'Cross-Provider Migration': 'from-blue-500 to-cyan-600',
  'Right-Sizing': 'from-orange-500 to-amber-600'
};

const CONFIDENCE_LABELS = {
  high: { min: 0.8, label: 'High', color: 'text-green-400' },
  medium: { min: 0.6, label: 'Medium', color: 'text-yellow-400' },
  low: { min: 0, label: 'Low', color: 'text-red-400' }
};

const OptimizationCard = ({ suggestion, onDismiss, onImplemented, className = '' }) => {
  const [expanded, setExpanded] = useState(false);

  const getConfidence = (score) => {
    if (score >= 0.8) return CONFIDENCE_LABELS.high;
    if (score >= 0.6) return CONFIDENCE_LABELS.medium;
    return CONFIDENCE_LABELS.low;
  };

  const confidence = getConfidence(suggestion.confidence_score);
  const gradientClass = CATEGORY_COLORS[suggestion.category] || 'from-gray-500 to-gray-600';

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden transition-all hover:border-white/30 ${className}`}>
      {/* Header gradient bar */}
      <div className={`h-1 bg-gradient-to-r ${gradientClass}`} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs bg-gradient-to-r ${gradientClass} text-white`}>
                {suggestion.category}
              </span>
              <span className={`text-xs ${confidence.color}`}>
                {confidence.label} confidence
              </span>
            </div>
            <h4 className="text-white font-semibold">
              {suggestion.affected_services?.[0] || 'Service Optimization'}
            </h4>
            <p className="text-sm text-white/60 mt-1">
              {suggestion.current_provider?.toUpperCase()}
              {suggestion.recommended_provider && suggestion.recommended_provider !== suggestion.current_provider && (
                <span className="inline-flex items-center gap-1 ml-2 text-blue-300">
                  <ArrowRight className="w-3 h-3" />
                  {suggestion.recommended_provider.toUpperCase()}
                </span>
              )}
            </p>
          </div>

          {/* Savings badge */}
          <div className="text-right ml-4">
            <div className="flex items-center gap-1 text-green-400">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xl font-bold">${suggestion.savings_amount?.toFixed(0)}</span>
            </div>
            <div className="text-xs text-white/60">/month saved</div>
            <div className="text-xs text-green-400">{suggestion.savings_percentage?.toFixed(0)}% less</div>
          </div>
        </div>

        {/* Cost comparison */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-lg">
          <div className="text-center">
            <div className="text-xs text-white/60">Current</div>
            <div className="text-white font-semibold">${suggestion.current_cost?.toFixed(2)}/mo</div>
          </div>
          <ArrowRight className="w-4 h-4 text-green-400 flex-shrink-0" />
          <div className="text-center">
            <div className="text-xs text-white/60">Optimized</div>
            <div className="text-green-400 font-semibold">${suggestion.optimized_cost?.toFixed(2)}/mo</div>
          </div>
          <div className="ml-auto text-center">
            <div className="text-xs text-white/60">Annual savings</div>
            <div className="text-green-300 font-bold">${(suggestion.savings_amount * 12)?.toFixed(0)}</div>
          </div>
        </div>

        {/* Expand/collapse action steps */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-sm text-white/70 hover:text-white transition-colors mb-3"
        >
          <span>Action Steps ({suggestion.action_steps?.length || 0})</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <ol className="space-y-2 mb-4">
            {(suggestion.action_steps || []).map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/30 text-blue-300 text-xs flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onImplemented?.(suggestion.suggestion_id)}
            className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-green-200 text-sm transition-colors flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-4 h-4" />
            Implement
          </button>
          <button
            onClick={() => onDismiss?.(suggestion.suggestion_id)}
            className="py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 text-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptimizationCard;
