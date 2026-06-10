/**
 * AI Optimization Center - Infrastructure Insights
 * 
 * Enterprise-grade cross-cloud and same-cloud cost optimization recommendations.
 * Features categorization, filtering, and visual utilization sparklines.
 */

import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Server,
  Database,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  TrendingDown,
  ArrowRight,
  PiggyBank,
  AlertCircle,
  Globe,
  Cpu,
  MemoryStick,
  Network,
  Zap,
  Filter
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { useAISettings } from '../context/AISettingsContext';

// --- Sparkline Components ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs shadow-lg z-50">
        <p className="text-gray-400 mb-0.5">{label}</p>
        <p className="text-white font-bold">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const Sparkline = ({ data, color }: { data: { name: string; value: number }[], color: string }) => (
  <ResponsiveContainer width="100%" height={40}>
    <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
      <Line 
        type="monotone" 
        dataKey="value" 
        stroke={color} 
        strokeWidth={2} 
        dot={false} 
        activeDot={{ r: 4, fill: color }}
      />
      <Tooltip content={<CustomTooltip />} />
    </LineChart>
  </ResponsiveContainer>
);

// --- Expanded Dummy Data with Categories and Optimization Types ---
const DUMMY_INFRA = [
  {
    id: 1,
    category: 'Compute',
    optimizationType: 'Cross-Cloud',
    currentProvider: 'AWS',
    type: 'Compute',
    icon: Server,
    name: 'EC2 t3.medium',
    count: 3,
    region: 'ap-south-1',
    currentCost: 91.10,
    status: 'warning',
    insight: 'Low CPU Utilization Detected (<15% average over 30 days)',
    utilization: {
      cpu: [{ name: 'Mon', value: 12 }, { name: 'Tue', value: 10 }, { name: 'Wed', value: 15 }, { name: 'Thu', value: 8 }, { name: 'Fri', value: 11 }, { name: 'Sat', value: 9 }, { name: 'Sun', value: 14 }],
      memory: [{ name: 'Mon', value: 35 }, { name: 'Tue', value: 38 }, { name: 'Wed', value: 32 }, { name: 'Thu', value: 40 }, { name: 'Fri', value: 37 }, { name: 'Sat', value: 34 }, { name: 'Sun', value: 36 }],
      network: [{ name: 'Mon', value: 5 }, { name: 'Tue', value: 4 }, { name: 'Wed', value: 6 }, { name: 'Thu', value: 3 }, { name: 'Fri', value: 5 }, { name: 'Sat', value: 4 }, { name: 'Sun', value: 5 }]
    },
    recommendation: {
      provider: 'GCP',
      providerIcon: '🌐',
      serviceName: 'Compute Engine e2-medium (x3)',
      estimatedCost: 68.40,
      savings: 22.70,
      note: 'GCP e2-medium offers better price-to-performance for burstable, low-utilization workloads in this region.'
    }
  },
  {
    id: 2,
    category: 'Compute',
    optimizationType: 'Same-Cloud',
    currentProvider: 'AWS',
    type: 'Compute',
    icon: Server,
    name: 'EC2 m5.large',
    count: 5,
    region: 'us-east-1',
    currentCost: 438.00,
    status: 'info',
    insight: 'Steady 24/7 workload with highly predictable usage patterns (>80% utilization)',
    utilization: {
      cpu: [{ name: 'Mon', value: 82 }, { name: 'Tue', value: 85 }, { name: 'Wed', value: 81 }, { name: 'Thu', value: 84 }, { name: 'Fri', value: 83 }, { name: 'Sat', value: 80 }, { name: 'Sun', value: 82 }],
      memory: [{ name: 'Mon', value: 75 }, { name: 'Tue', value: 78 }, { name: 'Wed', value: 74 }, { name: 'Thu', value: 77 }, { name: 'Fri', value: 76 }, { name: 'Sat', value: 73 }, { name: 'Sun', value: 75 }],
      network: [{ name: 'Mon', value: 45 }, { name: 'Tue', value: 48 }, { name: 'Wed', value: 44 }, { name: 'Thu', value: 47 }, { name: 'Fri', value: 46 }, { name: 'Sat', value: 43 }, { name: 'Sun', value: 45 }]
    },
    recommendation: {
      provider: 'AWS',
      providerIcon: '☁️',
      serviceName: 'AWS Compute Savings Plan (1-Year, No Upfront)',
      estimatedCost: 306.60,
      savings: 131.40,
      note: 'Same-cloud optimization: Committing to a consistent compute usage level yields an immediate ~30% discount without changing any infrastructure.'
    }
  },
  {
    id: 3,
    category: 'Compute',
    optimizationType: 'Cross-Cloud',
    currentProvider: 'Azure',
    type: 'Compute',
    icon: Server,
    name: 'Virtual Machines D4s_v3',
    count: 2,
    region: 'eastus',
    currentCost: 140.00,
    status: 'warning',
    insight: 'General purpose workload, not utilizing premium SSD or specialized features',
    utilization: {
      cpu: [{ name: 'Mon', value: 40 }, { name: 'Tue', value: 42 }, { name: 'Wed', value: 38 }, { name: 'Thu', value: 45 }, { name: 'Fri', value: 41 }, { name: 'Sat', value: 39 }, { name: 'Sun', value: 40 }],
      memory: [{ name: 'Mon', value: 50 }, { name: 'Tue', value: 52 }, { name: 'Wed', value: 48 }, { name: 'Thu', value: 55 }, { name: 'Fri', value: 51 }, { name: 'Sat', value: 49 }, { name: 'Sun', value: 50 }],
      network: [{ name: 'Mon', value: 20 }, { name: 'Tue', value: 22 }, { name: 'Wed', value: 18 }, { name: 'Thu', value: 25 }, { name: 'Fri', value: 21 }, { name: 'Sat', value: 19 }, { name: 'Sun', value: 20 }]
    },
    recommendation: {
      provider: 'GCP',
      providerIcon: '🌐',
      serviceName: 'Compute Engine N2D (AMD EPYC, 4 vCPU, 16GB RAM)',
      estimatedCost: 105.00,
      savings: 35.00,
      note: 'Cross-cloud alternative: GCP\'s N2D AMD instances provide equivalent or better performance for general-purpose workloads at a ~25% lower price point.'
    }
  },
  {
    id: 4,
    category: 'Database',
    optimizationType: 'Cross-Cloud',
    currentProvider: 'GCP',
    type: 'Database',
    icon: Database,
    name: 'Cloud SQL (PostgreSQL db-custom-2-4096)',
    count: 1,
    region: 'us-central1',
    currentCost: 85.00,
    status: 'warning',
    insight: 'Experiencing occasional read-heavy spikes causing brief CPU throttling',
    utilization: {
      cpu: [{ name: 'Mon', value: 45 }, { name: 'Tue', value: 60 }, { name: 'Wed', value: 42 }, { name: 'Thu', value: 85 }, { name: 'Fri', value: 50 }, { name: 'Sat', value: 40 }, { name: 'Sun', value: 45 }],
      memory: [{ name: 'Mon', value: 65 }, { name: 'Tue', value: 68 }, { name: 'Wed', value: 62 }, { name: 'Thu', value: 70 }, { name: 'Fri', value: 67 }, { name: 'Sat', value: 64 }, { name: 'Sun', value: 66 }],
      network: [{ name: 'Mon', value: 30 }, { name: 'Tue', value: 45 }, { name: 'Wed', value: 28 }, { name: 'Thu', value: 60 }, { name: 'Fri', value: 35 }, { name: 'Sat', value: 25 }, { name: 'Sun', value: 30 }]
    },
    recommendation: {
      provider: 'AWS',
      providerIcon: '☁️',
      serviceName: 'RDS PostgreSQL with 2x Read Replicas',
      estimatedCost: 70.00,
      savings: 15.00,
      note: 'Cross-cloud alternative: AWS RDS offers more granular, cost-effective read replica scaling for this specific read-heavy workload pattern.'
    }
  },
  {
    id: 5,
    category: 'Serverless',
    optimizationType: 'Same-Cloud',
    currentProvider: 'AWS',
    type: 'Serverless',
    icon: Zap,
    name: 'Lambda (High Invocation)',
    count: 1,
    region: 'us-east-1',
    currentCost: 65.00,
    status: 'info',
    insight: 'Consistent, high-volume invocations with long average execution times (>2s)',
    utilization: {
      cpu: [{ name: 'Mon', value: 90 }, { name: 'Tue', value: 92 }, { name: 'Wed', value: 88 }, { name: 'Thu', value: 95 }, { name: 'Fri', value: 91 }, { name: 'Sat', value: 89 }, { name: 'Sun', value: 90 }],
      memory: [{ name: 'Mon', value: 80 }, { name: 'Tue', value: 82 }, { name: 'Wed', value: 78 }, { name: 'Thu', value: 85 }, { name: 'Fri', value: 81 }, { name: 'Sat', value: 79 }, { name: 'Sun', value: 80 }],
      network: [{ name: 'Mon', value: 60 }, { name: 'Tue', value: 65 }, { name: 'Wed', value: 58 }, { name: 'Thu', value: 70 }, { name: 'Fri', value: 62 }, { name: 'Sat', value: 59 }, { name: 'Sun', value: 60 }]
    },
    recommendation: {
      provider: 'AWS',
      providerIcon: '☁️',
      serviceName: 'Migrate to AWS Fargate or use Provisioned Concurrency',
      estimatedCost: 40.00,
      savings: 25.00,
      note: 'Same-cloud optimization: For sustained, long-running tasks, containerized execution on Fargate is significantly more cost-effective than per-millisecond Lambda billing.'
    }
  },
  {
    id: 6,
    category: 'Storage',
    optimizationType: 'Same-Cloud',
    currentProvider: 'AWS',
    type: 'Storage',
    icon: HardDrive,
    name: 'EBS gp3 Volumes (Unattached)',
    count: 2,
    region: 'ap-south-1',
    currentCost: 16.00,
    status: 'critical',
    insight: '2x 100GB volumes have been unattached and idle for >14 days (0% I/O)',
    utilization: {
      cpu: [{ name: 'Mon', value: 0 }, { name: 'Tue', value: 0 }, { name: 'Wed', value: 0 }, { name: 'Thu', value: 0 }, { name: 'Fri', value: 0 }, { name: 'Sat', value: 0 }, { name: 'Sun', value: 0 }],
      memory: [{ name: 'Mon', value: 0 }, { name: 'Tue', value: 0 }, { name: 'Wed', value: 0 }, { name: 'Thu', value: 0 }, { name: 'Fri', value: 0 }, { name: 'Sat', value: 0 }, { name: 'Sun', value: 0 }],
      network: [{ name: 'Mon', value: 0 }, { name: 'Tue', value: 0 }, { name: 'Wed', value: 0 }, { name: 'Thu', value: 0 }, { name: 'Fri', value: 0 }, { name: 'Sat', value: 0 }, { name: 'Sun', value: 0 }]
    },
    recommendation: {
      provider: 'AWS / GCP',
      providerIcon: '☁️',
      serviceName: 'Snapshot & Terminate (or migrate to GCP Balanced PD)',
      estimatedCost: 4.00,
      savings: 12.00,
      note: 'Immediate cleanup recommended. If active storage is needed, GCP Balanced Persistent Disk is ~15% cheaper in this region.'
    }
  }
];

const AIOptimizationCenter = () => {
  const { isConfigured } = useAISettings();
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');

  const filteredInfra = useMemo(() => {
    return DUMMY_INFRA.filter(item => {
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      const matchesType = typeFilter === 'All' || item.optimizationType === typeFilter;
      return matchesCategory && matchesType;
    });
  }, [categoryFilter, typeFilter]);

  const totalCurrentCost = filteredInfra.reduce((sum, item) => sum + item.currentCost, 0);
  const totalPotentialSavings = filteredInfra.reduce((sum, item) => sum + item.recommendation.savings, 0);

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center p-8 bg-white/5 rounded-2xl border border-white/10 max-w-md">
          <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">AI Not Configured</h3>
          <p className="text-gray-400 mb-6">Please configure your AI provider (Gemini, OpenAI, Ollama, etc.) in the settings to enable cross-cloud optimization insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-400" />
          Cross-Cloud Infrastructure Insights
        </h2>
        <p className="text-gray-400 text-sm mt-1">
          AI-powered analysis comparing your current infrastructure against optimal configurations across AWS, Azure, and GCP.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1">
          <span className="text-xs text-gray-400 pl-2">Resource:</span>
          {['All', 'Compute', 'Database', 'Storage', 'Serverless'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                categoryFilter === cat ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-1">
          <span className="text-xs text-gray-400 pl-2">Type:</span>
          {['All', 'Cross-Cloud', 'Same-Cloud'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === type ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Current Monthly Spend (Filtered)</p>
          <p className="text-2xl font-bold text-white">${totalCurrentCost.toFixed(2)}</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Potential Monthly Savings</p>
          <p className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <PiggyBank className="w-5 h-5" />
            ${totalPotentialSavings.toFixed(2)}
          </p>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-xs text-indigo-400 uppercase tracking-wider mb-1">Optimization Score</p>
          <p className="text-2xl font-bold text-indigo-400">68/100</p>
          <p className="text-[10px] text-gray-500 mt-1">Based on cross-cloud & same-cloud benchmarking</p>
        </div>
      </div>

      {/* Infrastructure Recommendations List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-400" />
          Actionable Recommendations
        </h3>

        {filteredInfra.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recommendations match your current filters.</p>
          </div>
        )}

        {filteredInfra.map((item) => {
          const Icon = item.icon;
          const statusColor = item.status === 'critical' ? 'border-red-500/30 bg-red-500/5' : 
                              item.status === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-blue-500/30 bg-blue-500/5';
          const badgeColor = item.status === 'critical' ? 'text-red-400 bg-red-500/10' : 
                             item.status === 'warning' ? 'text-yellow-400 bg-yellow-500/10' : 'text-blue-400 bg-blue-500/10';

          return (
            <div key={item.id} className={`p-5 rounded-xl border ${statusColor} transition-all hover:bg-white/10`}>
              {/* Current Resource Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${badgeColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-semibold">{item.name}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 border border-white/10">
                        {item.currentProvider}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        item.optimizationType === 'Cross-Cloud' ? 'text-purple-400 border-purple-400/20 bg-purple-400/10' : 'text-indigo-400 border-indigo-400/20 bg-indigo-400/10'
                      }`}>
                        {item.optimizationType}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{item.count}x instance(s) • {item.region}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Current Cost</p>
                  <p className="text-white font-mono font-medium text-lg">${item.currentCost.toFixed(2)}<span className="text-xs text-gray-500">/mo</span></p>
                </div>
              </div>

              {/* AI Insight & Sparklines */}
              <div className="mb-4 p-4 bg-black/20 rounded-lg border border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" /> AI Insight
                </p>
                <p className="text-sm text-gray-200 mb-4">{item.insight}</p>
                
                {/* 7-Day Utilization Sparklines */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-white/10">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Cpu className="w-3 h-3 text-blue-400" />
                      <span className="text-[10px] text-gray-400 uppercase">CPU (7 Days)</span>
                    </div>
                    <Sparkline data={item.utilization.cpu} color="#60a5fa" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MemoryStick className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-gray-400 uppercase">Memory (7 Days)</span>
                    </div>
                    <Sparkline data={item.utilization.memory} color="#c084fc" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Network className="w-3 h-3 text-emerald-400" />
                      <span className="text-[10px] text-gray-400 uppercase">Network I/O (7 Days)</span>
                    </div>
                    <Sparkline data={item.utilization.network} color="#34d399" />
                  </div>
                </div>
              </div>

              {/* Cross-Cloud / Same-Cloud Recommendation */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <div className="lg:col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3 text-emerald-400" /> Recommended Alternative
                  </p>
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">{item.recommendation.providerIcon}</span>
                    <div>
                      <p className="text-sm text-white font-medium">{item.recommendation.serviceName}</p>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.recommendation.note}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col justify-center items-start lg:items-end bg-emerald-500/5 rounded-lg p-3 border border-emerald-500/10">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estimated Impact</p>
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-xl font-bold">Save ${item.recommendation.savings.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-400">New estimated cost: <span className="text-white font-mono">${item.recommendation.estimatedCost.toFixed(2)}/mo</span></p>
                  <button className="mt-3 w-full px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    View Migration Steps
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Pro Tip Footer */}
        <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
          <p className="text-sm text-indigo-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Live Mode:</strong> In a production environment, this dashboard connects to your live cloud billing APIs (AWS Cost Explorer, Azure Cost Management, GCP Billing) and real-time utilization metrics (Prometheus/CloudWatch) to generate dynamic, personalized cross-cloud migration recommendations.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIOptimizationCenter;