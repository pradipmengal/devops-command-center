/**
 * ComparisonChart Component
 * 
 * Visual chart for service price comparison.
 * Bar chart showing price differences across services.
 * 
 * Requirements:
 *   - Requirement 9.4: Visual price comparison
 *   - Requirement 9.5: Interactive chart
 * 
 * Features:
 *   - Bar chart visualization
 *   - Color-coded by provider
 *   - Hover tooltips
 *   - Responsive design
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';

const ComparisonChart = ({ services = [] }) => {
  if (services.length === 0) return null;

  const maxPrice = Math.max(...services.map(s => s.price_usd));
  
  const getProviderColor = (provider) => {
    const colors = {
      aws: '#FF9900',
      azure: '#0078D4',
      gcp: '#EA4335',
      oci: '#F80000',
      digitalocean: '#0080FF',
      alibaba: '#FF6A00',
      tata_cloud: '#A855F7',
      jio_cloud: '#22C55E',
      yotta: '#F59E0B',
      nxtgen: '#06B6D4'
    };
    return colors[provider] || '#6B7280';
  };

  return (
    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-white/80" />
        <h4 className="text-lg font-semibold text-white">Price Comparison</h4>
      </div>

      <div className="space-y-4">
        {services.map((service, index) => {
          const widthPercent = (service.price_usd / maxPrice) * 100;
          
          return (
            <div key={index} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {service.service_name}
                  </span>
                  <span className="text-xs text-white/60 uppercase">
                    ({service.provider})
                  </span>
                  {service.isCheapest && (
                    <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-200">
                      Cheapest
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-white">
                  ${service.price_usd.toFixed(4)}
                </span>
              </div>
              
              <div className="relative h-8 bg-white/5 rounded-lg overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500 group-hover:opacity-80"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: getProviderColor(service.provider)
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-end pr-3">
                    {widthPercent > 20 && (
                      <span className="text-xs font-medium text-white">
                        {service.unit}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {!service.isCheapest && (
                <div className="mt-1 text-xs text-red-300">
                  +${service.priceDiff.toFixed(4)} ({service.priceDiffPct.toFixed(1)}% more)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComparisonChart;
