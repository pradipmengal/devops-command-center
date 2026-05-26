/**
 * CategoryFilter Component
 * 
 * Multi-select category filter with service count badges.
 * Allows users to filter services by logical categories.
 * 
 * Requirements:
 *   - Requirement 6.5: Category-based filtering
 *   - Requirement 6.6: Service count per category
 *   - Requirement 6.7: Visual category grouping
 * 
 * Features:
 *   - Multi-select with checkboxes
 *   - Service count badges
 *   - Category icons
 *   - Collapsible groups
 *   - Quick filters (Popular, All)
 */

import React, { useState } from 'react';
import {
  Server, Database, HardDrive, Cloud, Cpu, Network,
  Globe, Shield, BarChart, Zap, Box, Layers, ChevronDown, ChevronRight
} from 'lucide-react';

const CategoryFilter = ({
  selectedCategories = [],
  onCategoryToggle,
  serviceCounts = {},
  className = ''
}) => {
  const [expandedGroups, setExpandedGroups] = useState(['compute', 'storage', 'database']);

  // Category definitions with icons and grouping
  const categoryGroups = {
    compute: {
      label: 'Compute',
      icon: Cpu,
      categories: [
        { id: 'Compute (VMs)', label: 'Virtual Machines', icon: Server },
        { id: 'Managed Kubernetes', label: 'Kubernetes', icon: Layers },
        { id: 'Serverless Functions', label: 'Serverless', icon: Zap }
      ]
    },
    storage: {
      label: 'Storage',
      icon: HardDrive,
      categories: [
        { id: 'Object Storage', label: 'Object Storage', icon: Box },
        { id: 'Block Storage', label: 'Block Storage', icon: HardDrive },
        { id: 'CDN', label: 'Content Delivery', icon: Globe }
      ]
    },
    database: {
      label: 'Database',
      icon: Database,
      categories: [
        { id: 'Relational Database', label: 'SQL Databases', icon: Database },
        { id: 'NoSQL Database', label: 'NoSQL Databases', icon: Database }
      ]
    },
    networking: {
      label: 'Networking',
      icon: Network,
      categories: [
        { id: 'Load Balancers', label: 'Load Balancers', icon: Network },
        { id: 'DNS', label: 'DNS Services', icon: Globe },
        { id: 'Networking', label: 'Other Networking', icon: Network }
      ]
    },
    advanced: {
      label: 'Advanced Services',
      icon: Cloud,
      categories: [
        { id: 'AI/ML Services', label: 'AI & Machine Learning', icon: BarChart },
        { id: 'Analytics', label: 'Analytics', icon: BarChart },
        { id: 'Monitoring', label: 'Monitoring', icon: BarChart },
        { id: 'Security', label: 'Security', icon: Shield }
      ]
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const selectPopular = () => {
    const popular = [
      'Compute (VMs)',
      'Object Storage',
      'Relational Database',
      'Managed Kubernetes'
    ];
    
    popular.forEach(categoryId => {
      if (!selectedCategories.includes(categoryId)) {
        onCategoryToggle(categoryId);
      }
    });
  };

  const selectAll = () => {
    Object.values(categoryGroups).forEach(group => {
      group.categories.forEach(category => {
        if (!selectedCategories.includes(category.id)) {
          onCategoryToggle(category.id);
        }
      });
    });
  };

  const clearAll = () => {
    selectedCategories.forEach(categoryId => onCategoryToggle(categoryId));
  };

  const getTotalServiceCount = () => {
    return Object.values(serviceCounts).reduce((sum, count) => sum + count, 0);
  };

  const getSelectedServiceCount = () => {
    return selectedCategories.reduce((sum, categoryId) => {
      return sum + (serviceCounts[categoryId] || 0);
    }, 0);
  };

  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          Filter by Category
        </h3>
        <div className="text-sm text-white/60">
          {selectedCategories.length > 0 ? (
            <span>
              {getSelectedServiceCount()} of {getTotalServiceCount()} services
            </span>
          ) : (
            <span>{getTotalServiceCount()} services</span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={selectPopular}
          className="flex-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-sm text-blue-200 transition-colors"
        >
          Popular
        </button>
        <button
          onClick={selectAll}
          className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
        >
          All
        </button>
        {selectedCategories.length > 0 && (
          <button
            onClick={clearAll}
            className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Groups */}
      <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
        {Object.entries(categoryGroups).map(([groupId, group]) => {
          const isExpanded = expandedGroups.includes(groupId);
          const GroupIcon = group.icon;
          
          // Calculate group service count
          const groupServiceCount = group.categories.reduce((sum, cat) => {
            return sum + (serviceCounts[cat.id] || 0);
          }, 0);

          return (
            <div key={groupId} className="bg-white/5 rounded-lg overflow-hidden">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(groupId)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-white/60 mr-2" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/60 mr-2" />
                  )}
                  <GroupIcon className="w-5 h-5 text-white/80 mr-2" />
                  <span className="text-white font-medium">{group.label}</span>
                </div>
                {groupServiceCount > 0 && (
                  <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/80">
                    {groupServiceCount}
                  </span>
                )}
              </button>

              {/* Group Categories */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  {group.categories.map((category) => {
                    const isSelected = selectedCategories.includes(category.id);
                    const count = serviceCounts[category.id] || 0;
                    const CategoryIcon = category.icon;

                    return (
                      <label
                        key={category.id}
                        className="flex items-center p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onCategoryToggle(category.id)}
                          className="w-4 h-4 rounded border-white/20 bg-white/10 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <CategoryIcon className="w-4 h-4 text-white/60 ml-3 mr-2" />
                        <span className="text-white text-sm flex-1">
                          {category.label}
                        </span>
                        {count > 0 && (
                          <span className={`
                            px-2 py-0.5 rounded-full text-xs
                            ${isSelected
                              ? 'bg-blue-500/30 text-blue-200'
                              : 'bg-white/10 text-white/60'
                            }
                          `}>
                            {count}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Message */}
      {selectedCategories.length === 0 && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-200">
            No categories selected - showing all categories
          </p>
        </div>
      )}

      {/* Selected Categories Summary */}
      {selectedCategories.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-xs text-white/60 mb-2">Selected Categories:</div>
          <div className="flex flex-wrap gap-2">
            {selectedCategories.map(categoryId => {
              // Find the category label
              let categoryLabel = categoryId;
              Object.values(categoryGroups).forEach(group => {
                const cat = group.categories.find(c => c.id === categoryId);
                if (cat) categoryLabel = cat.label;
              });

              return (
                <span
                  key={categoryId}
                  className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs text-blue-200 flex items-center gap-1"
                >
                  {categoryLabel}
                  <button
                    onClick={() => onCategoryToggle(categoryId)}
                    className="hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;
