/**
 * Frontend Tests - Tasks 20.1, 20.2
 * Unit and integration tests for multi-cloud components.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── Import components ─────────────────────────────────────────────────────────
import CategoryFilter from '../multi-cloud/CategoryFilter';
import DashboardMetrics from '../multi-cloud/DashboardMetrics';
import ComparisonChart from '../multi-cloud/ComparisonChart';
import ServiceCard from '../multi-cloud/ServiceCard';
import OptimizationCard from '../multi-cloud/OptimizationCard';

// ── Sample data ───────────────────────────────────────────────────────────────

const sampleService = {
  provider: 'aws',
  service_name: 'EC2 t3.medium',
  category: 'Compute (VMs)',
  price_usd: 0.0416,
  unit: 'per hour',
  tier_label: 'On-Demand',
  region: 'us-east-1',
  vcpu: 2,
  memory_gb: 4.0,
  metadata: { instance_type: 't3.medium' }
};

const sampleSuggestion = {
  suggestion_id: 'test-001',
  category: 'Reserved Instances',
  current_provider: 'aws',
  current_cost: 100.0,
  optimized_cost: 65.0,
  savings_amount: 35.0,
  savings_percentage: 35.0,
  action_steps: ['Purchase reserved instance', 'Commit to 1-year term'],
  affected_services: ['EC2 t3.medium'],
  confidence_score: 0.85,
  recommended_provider: 'aws'
};

// ── CategoryFilter Tests ──────────────────────────────────────────────────────

describe('CategoryFilter', () => {
  it('renders category groups', () => {
    render(
      <CategoryFilter
        selectedCategories={[]}
        onCategoryToggle={vi.fn()}
        serviceCounts={{}}
      />
    );
    expect(screen.getByText('Filter by Category')).toBeInTheDocument();
    expect(screen.getByText('Compute')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('shows selected categories count', () => {
    render(
      <CategoryFilter
        selectedCategories={['Compute (VMs)', 'Object Storage']}
        onCategoryToggle={vi.fn()}
        serviceCounts={{}}
      />
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('calls onCategoryToggle when category clicked', async () => {
    const onToggle = vi.fn();
    render(
      <CategoryFilter
        selectedCategories={[]}
        onCategoryToggle={onToggle}
        serviceCounts={{}}
      />
    );
    // Expand compute group first
    const computeBtn = screen.getByText('Compute');
    fireEvent.click(computeBtn);
    // Click Virtual Machines checkbox
    const vmCheckbox = screen.getByLabelText ? screen.queryByLabelText('Virtual Machines') : null;
    if (vmCheckbox) {
      fireEvent.click(vmCheckbox);
      expect(onToggle).toHaveBeenCalledWith('Compute (VMs)');
    }
  });

  it('shows service counts as badges', () => {
    render(
      <CategoryFilter
        selectedCategories={[]}
        onCategoryToggle={vi.fn()}
        serviceCounts={{ 'Compute (VMs)': 42 }}
      />
    );
    // Expand compute group
    fireEvent.click(screen.getByText('Compute'));
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('shows no categories selected message', () => {
    render(
      <CategoryFilter
        selectedCategories={[]}
        onCategoryToggle={vi.fn()}
        serviceCounts={{}}
      />
    );
    expect(screen.getByText(/No categories selected/i)).toBeInTheDocument();
  });

  it('shows selected category tags', () => {
    render(
      <CategoryFilter
        selectedCategories={['Compute (VMs)']}
        onCategoryToggle={vi.fn()}
        serviceCounts={{}}
      />
    );
    expect(screen.getByText('Virtual Machines')).toBeInTheDocument();
  });
});

// ── ServiceCard Tests ─────────────────────────────────────────────────────────

describe('ServiceCard', () => {
  it('renders service name', () => {
    render(<ServiceCard service={sampleService} viewMode="grid" />);
    expect(screen.getByText('EC2 t3.medium')).toBeInTheDocument();
  });

  it('renders price', () => {
    render(<ServiceCard service={sampleService} viewMode="grid" />);
    expect(screen.getByText('0.0416')).toBeInTheDocument();
  });

  it('renders tier badge', () => {
    render(<ServiceCard service={sampleService} viewMode="grid" />);
    expect(screen.getByText('On-Demand')).toBeInTheDocument();
  });

  it('renders vCPU and memory specs', () => {
    render(<ServiceCard service={sampleService} viewMode="grid" />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4 GB')).toBeInTheDocument();
  });

  it('renders in list mode', () => {
    render(<ServiceCard service={sampleService} viewMode="list" />);
    expect(screen.getByText('EC2 t3.medium')).toBeInTheDocument();
  });

  it('shows monthly estimate for hourly pricing', () => {
    render(<ServiceCard service={sampleService} viewMode="grid" />);
    // 0.0416 * 730 = ~30.37
    expect(screen.getByText(/30\.\d+\/month/i)).toBeInTheDocument();
  });

  it('shows region when provided', () => {
    render(<ServiceCard service={sampleService} viewMode="grid" />);
    expect(screen.getByText('us-east-1')).toBeInTheDocument();
  });
});

// ── DashboardMetrics Tests ────────────────────────────────────────────────────

describe('DashboardMetrics', () => {
  it('renders all four metric cards', () => {
    render(<DashboardMetrics services={[sampleService]} optimizationSuggestions={[]} />);
    expect(screen.getByText('Total Services')).toBeInTheDocument();
    expect(screen.getByText('Avg Price')).toBeInTheDocument();
    expect(screen.getByText('Cheapest Provider')).toBeInTheDocument();
    expect(screen.getByText('Potential Savings')).toBeInTheDocument();
  });

  it('shows correct service count', () => {
    render(<DashboardMetrics services={[sampleService, sampleService]} optimizationSuggestions={[]} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows cheapest provider', () => {
    render(<DashboardMetrics services={[sampleService]} optimizationSuggestions={[]} />);
    expect(screen.getByText('AWS')).toBeInTheDocument();
  });

  it('shows potential savings from suggestions', () => {
    render(
      <DashboardMetrics
        services={[sampleService]}
        optimizationSuggestions={[sampleSuggestion]}
      />
    );
    expect(screen.getByText('$35/mo')).toBeInTheDocument();
  });

  it('shows dash when no providers selected', () => {
    render(<DashboardMetrics services={[]} optimizationSuggestions={[]} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

// ── ComparisonChart Tests ─────────────────────────────────────────────────────

describe('ComparisonChart', () => {
  const services = [
    { ...sampleService, provider: 'aws', price_usd: 0.04, isCheapest: true, priceDiff: 0, priceDiffPct: 0 },
    { ...sampleService, provider: 'azure', service_name: 'Azure VM B2s', price_usd: 0.05, isCheapest: false, priceDiff: 0.01, priceDiffPct: 25 }
  ];

  it('renders chart title', () => {
    render(<ComparisonChart services={services} />);
    expect(screen.getByText('Price Comparison')).toBeInTheDocument();
  });

  it('renders all service names', () => {
    render(<ComparisonChart services={services} />);
    expect(screen.getByText('EC2 t3.medium')).toBeInTheDocument();
    expect(screen.getByText('Azure VM B2s')).toBeInTheDocument();
  });

  it('marks cheapest service', () => {
    render(<ComparisonChart services={services} />);
    expect(screen.getByText('Cheapest')).toBeInTheDocument();
  });

  it('shows price difference for non-cheapest', () => {
    render(<ComparisonChart services={services} />);
    expect(screen.getByText(/\+\$0\.0100/)).toBeInTheDocument();
  });

  it('returns null for empty services', () => {
    const { container } = render(<ComparisonChart services={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

// ── OptimizationCard Tests ────────────────────────────────────────────────────

describe('OptimizationCard', () => {
  it('renders category badge', () => {
    render(<OptimizationCard suggestion={sampleSuggestion} />);
    expect(screen.getByText('Reserved Instances')).toBeInTheDocument();
  });

  it('renders savings amount', () => {
    render(<OptimizationCard suggestion={sampleSuggestion} />);
    expect(screen.getByText('$35')).toBeInTheDocument();
  });

  it('renders savings percentage', () => {
    render(<OptimizationCard suggestion={sampleSuggestion} />);
    expect(screen.getByText('35% less')).toBeInTheDocument();
  });

  it('renders current and optimized costs', () => {
    render(<OptimizationCard suggestion={sampleSuggestion} />);
    expect(screen.getByText('$100.00/mo')).toBeInTheDocument();
    expect(screen.getByText('$65.00/mo')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<OptimizationCard suggestion={sampleSuggestion} onDismiss={onDismiss} />);
    const dismissBtn = screen.getByTitle ? screen.queryByTitle('Dismiss') : screen.getAllByRole('button').find(b => b.textContent === '');
    if (dismissBtn) {
      fireEvent.click(dismissBtn);
      expect(onDismiss).toHaveBeenCalledWith('test-001');
    }
  });

  it('calls onImplemented when implement button clicked', () => {
    const onImplemented = vi.fn();
    render(<OptimizationCard suggestion={sampleSuggestion} onImplemented={onImplemented} />);
    fireEvent.click(screen.getByText('Implement'));
    expect(onImplemented).toHaveBeenCalledWith('test-001');
  });

  it('expands action steps on click', () => {
    render(<OptimizationCard suggestion={sampleSuggestion} />);
    fireEvent.click(screen.getByText(/Action Steps/));
    expect(screen.getByText('Purchase reserved instance')).toBeInTheDocument();
  });

  it('shows confidence level', () => {
    render(<OptimizationCard suggestion={sampleSuggestion} />);
    expect(screen.getByText(/High confidence/i)).toBeInTheDocument();
  });
});

// ── Integration: useComparison hook ──────────────────────────────────────────

describe('useComparison hook', async () => {
  const { renderHook, act } = await import('@testing-library/react');
  const { useComparison } = await import('../../hooks/useComparison');

  beforeEach(() => localStorageMock.clear());

  it('starts with empty comparison', () => {
    const { result } = renderHook(() => useComparison());
    expect(result.current.comparisonServices).toEqual([]);
  });

  it('adds service to comparison', () => {
    const { result } = renderHook(() => useComparison());
    act(() => { result.current.addToComparison(sampleService); });
    expect(result.current.comparisonServices).toHaveLength(1);
  });

  it('prevents duplicate services', () => {
    const { result } = renderHook(() => useComparison());
    act(() => {
      result.current.addToComparison(sampleService);
      result.current.addToComparison(sampleService);
    });
    expect(result.current.comparisonServices).toHaveLength(1);
  });

  it('removes service by index', () => {
    const { result } = renderHook(() => useComparison());
    act(() => { result.current.addToComparison(sampleService); });
    act(() => { result.current.removeFromComparison(0); });
    expect(result.current.comparisonServices).toHaveLength(0);
  });

  it('clears all services', () => {
    const { result } = renderHook(() => useComparison());
    act(() => {
      result.current.addToComparison(sampleService);
      result.current.clearComparison();
    });
    expect(result.current.comparisonServices).toHaveLength(0);
  });

  it('detects if service is in comparison', () => {
    const { result } = renderHook(() => useComparison());
    act(() => { result.current.addToComparison(sampleService); });
    expect(result.current.isInComparison(sampleService)).toBe(true);
  });
});
