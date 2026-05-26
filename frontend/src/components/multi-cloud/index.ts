/**
 * Multi-Cloud Cost Intelligence Platform - Component Exports
 * All components with ARIA accessibility support built in.
 */

// Phase 7: Selection Components
export { default as ProviderSelector } from './ProviderSelector';
export { default as RegionSelector } from './RegionSelector';
export { default as CategoryFilter } from './CategoryFilter';

// Phase 8: Service Catalog Components
export { default as ServiceCatalog } from './ServiceCatalog';
export { default as ServiceCard } from './ServiceCard';
export { default as ServiceSearch } from './ServiceSearch';

// Phase 9: Comparison Components
export { default as ComparisonPanel } from './ComparisonPanel';
export { default as ComparisonChart } from './ComparisonChart';

// Phase 11: Cost Estimation Components
export { default as CostEstimator } from './CostEstimator';
export { default as CostBreakdown } from './CostBreakdown';

// Phase 13: AI Optimization Components
export { default as OptimizationCard } from './OptimizationCard';
export { default as OptimizationPanel } from './OptimizationPanel';

// Phase 14: Dashboard Components
export { default as DashboardHeader } from './DashboardHeader';
export { default as DashboardMetrics } from './DashboardMetrics';

// Phase 15: Performance Components
export { default as VirtualServiceList } from './VirtualServiceList';
export { default as LazyServiceDetail } from './LazyServiceDetail';

// Phase 16: Currency
export { default as CurrencySelector } from './CurrencySelector';

// Phase 18: Sharing
export { default as ShareButton } from './ShareButton';

// Phase 21: Accessibility Utilities
export {
  LiveRegion,
  SkipLink,
  FocusTrap,
  KeyboardNavigableList,
  AccessibleButton,
  AccessibleCheckbox,
  AccessibleModal,
  useAnnounce
} from './AccessibleWrapper';
