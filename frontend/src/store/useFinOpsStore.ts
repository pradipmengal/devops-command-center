/**
 * useFinOpsStore — enterprise FinOps platform state.
 * Manages navigation, workspace, copilot, events, and infrastructure studio.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Navigation ────────────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: 'overview',       label: 'Overview',            icon: 'LayoutDashboard', group: 'platform' },
  { id: 'studio',         label: 'Infrastructure Studio', icon: 'Boxes',          group: 'platform', badge: 'NEW' },
  { id: 'kubernetes',     label: 'Kubernetes Cost',     icon: 'Container',       group: 'platform' },
  { id: 'accounts',       label: 'Cloud Accounts',      icon: 'Cloud',           group: 'platform' },
  { id: 'optimization',   label: 'Optimization',        icon: 'Zap',             group: 'intelligence' },
  { id: 'forecasting',    label: 'Forecasting',         icon: 'TrendingUp',      group: 'intelligence' },
  { id: 'anomalies',      label: 'Anomalies',           icon: 'AlertTriangle',   group: 'intelligence', badge: '3' },
  { id: 'ai-insights',    label: 'AI Insights',         icon: 'Sparkles',        group: 'intelligence' },
  { id: 'policies',       label: 'Policies',            icon: 'Shield',          group: 'governance' },
  { id: 'reports',        label: 'Reports',             icon: 'FileBarChart',    group: 'governance' },
  { id: 'settings',       label: 'Settings',            icon: 'Settings',        group: 'system' },
]

export const NAV_GROUPS = [
  { id: 'platform',      label: 'Platform' },
  { id: 'intelligence',  label: 'Intelligence' },
  { id: 'governance',    label: 'Governance' },
  { id: 'system',        label: 'System' },
]

// ── Live event types ──────────────────────────────────────────────────────────
export const EVENT_TYPES = {
  SYNC:        'sync',
  ANOMALY:     'anomaly',
  BUDGET:      'budget',
  OPTIMIZE:    'optimize',
  K8S:         'k8s',
  AI:          'ai',
  DEPLOY:      'deploy',
}

const INITIAL_EVENTS = [
  { id: 'e1', type: EVENT_TYPES.SYNC,     message: 'AWS CUR sync completed — 81 services updated', time: '2s ago',   status: 'success' },
  { id: 'e2', type: EVENT_TYPES.ANOMALY,  message: 'Cost spike detected: CloudWatch Logs +340%',   time: '14s ago',  status: 'warning' },
  { id: 'e3', type: EVENT_TYPES.AI,       message: 'Optimization analysis complete — 7 recommendations', time: '1m ago', status: 'info' },
  { id: 'e4', type: EVENT_TYPES.BUDGET,   message: 'Budget threshold 85% reached: Production account', time: '3m ago', status: 'warning' },
  { id: 'e5', type: EVENT_TYPES.K8S,      message: 'EKS cluster: 3 idle pods detected in staging',  time: '5m ago',  status: 'info' },
]

// ── Infrastructure Studio node catalog ───────────────────────────────────────
export const NODE_CATALOG = [
  // AWS Compute
  { type: 'ec2',        label: 'EC2',           provider: 'AWS',   category: 'Compute',    icon: '⚡', baseCost: 0.0416,  unit: '/hr',   color: '#f97316' },
  { type: 'eks',        label: 'EKS',           provider: 'AWS',   category: 'Kubernetes', icon: '☸',  baseCost: 0.10,    unit: '/hr',   color: '#f97316' },
  { type: 'ecs',        label: 'ECS Fargate',   provider: 'AWS',   category: 'Containers', icon: '🐳', baseCost: 0.04048, unit: '/vCPU/hr', color: '#f97316' },
  { type: 'lambda',     label: 'Lambda',        provider: 'AWS',   category: 'Serverless', icon: 'λ',  baseCost: 0.20,    unit: '/1M req', color: '#f97316' },
  { type: 'rds',        label: 'RDS',           provider: 'AWS',   category: 'Database',   icon: '🗄', baseCost: 0.068,   unit: '/hr',   color: '#f97316' },
  { type: 's3',         label: 'S3',            provider: 'AWS',   category: 'Storage',    icon: '🪣', baseCost: 0.023,   unit: '/GB/mo', color: '#f97316' },
  { type: 'alb',        label: 'Load Balancer', provider: 'AWS',   category: 'Networking', icon: '⚖', baseCost: 0.008,   unit: '/hr',   color: '#f97316' },
  { type: 'elasticache',label: 'ElastiCache',   provider: 'AWS',   category: 'Cache',      icon: '⚡', baseCost: 0.017,   unit: '/hr',   color: '#f97316' },
  // Azure
  { type: 'azure-vm',   label: 'Azure VM',      provider: 'Azure', category: 'Compute',    icon: '🔷', baseCost: 0.0416,  unit: '/hr',   color: '#3b82f6' },
  { type: 'aks',        label: 'AKS',           provider: 'Azure', category: 'Kubernetes', icon: '☸',  baseCost: 0.10,    unit: '/hr',   color: '#3b82f6' },
  { type: 'azure-sql',  label: 'Azure SQL',     provider: 'Azure', category: 'Database',   icon: '🗄', baseCost: 0.150,   unit: '/hr',   color: '#3b82f6' },
  { type: 'blob',       label: 'Blob Storage',  provider: 'Azure', category: 'Storage',    icon: '🪣', baseCost: 0.018,   unit: '/GB/mo', color: '#3b82f6' },
  // GCP
  { type: 'gce',        label: 'Compute Engine',provider: 'GCP',   category: 'Compute',    icon: '🟢', baseCost: 0.0335,  unit: '/hr',   color: '#22c55e' },
  { type: 'gke',        label: 'GKE',           provider: 'GCP',   category: 'Kubernetes', icon: '☸',  baseCost: 0.10,    unit: '/hr',   color: '#22c55e' },
  { type: 'cloud-sql',  label: 'Cloud SQL',     provider: 'GCP',   category: 'Database',   icon: '🗄', baseCost: 0.0965,  unit: '/hr',   color: '#22c55e' },
  { type: 'gcs',        label: 'Cloud Storage', provider: 'GCP',   category: 'Storage',    icon: '🪣', baseCost: 0.020,   unit: '/GB/mo', color: '#22c55e' },
]

interface FinOpsState {
  activeView: string;
  sidebarCollapsed: boolean;
  setActiveView: (view: string) => void;
  toggleSidebar: () => void;
  copilotOpen: boolean;
  copilotWidth: number;
  setCopilotOpen: (open: boolean) => void;
  setCopilotWidth: (w: number) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  eventBarExpanded: boolean;
  events: any[];
  setEventBarExpanded: (v: boolean) => void;
  pushEvent: (event: any) => void;
  studioNodes: any[];
  studioEdges: any[];
  setStudioNodes: (nodes: any[]) => void;
  setStudioEdges: (edges: any[]) => void;
  studioCost: { monthly: number; hourly: number; yearly: number };
  setStudioCost: (cost: any) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  syncStatus: string;
  lastSyncedAt: string | null;
  setSyncStatus: (status: string) => void;
  setLastSyncedAt: (t: string | null) => void;
  theme: string;
}

// ── Store ─────────────────────────────────────────────────────────────────────
const useFinOpsStore = create<FinOpsState>()(
  persist(
    (set, get) => ({
      // Navigation
      activeView: 'overview',
      sidebarCollapsed: false,
      setActiveView: (view) => set({ activeView: view }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // Right copilot panel
      copilotOpen: true,
      copilotWidth: 340,
      setCopilotOpen: (open) => set({ copilotOpen: open }),
      setCopilotWidth: (w) => set({ copilotWidth: Math.max(280, Math.min(600, w)) }),

      // Command palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      // Bottom event bar
      eventBarExpanded: false,
      events: INITIAL_EVENTS,
      setEventBarExpanded: (v) => set({ eventBarExpanded: v }),
      pushEvent: (event) => set((s) => ({
        events: [{ ...event, id: `e${Date.now()}`, time: 'just now' }, ...s.events].slice(0, 50),
      })),

      // Infrastructure Studio nodes
      studioNodes: [],
      studioEdges: [],
      setStudioNodes: (nodes) => set({ studioNodes: nodes }),
      setStudioEdges: (edges) => set({ studioEdges: edges }),

      // Studio total cost (derived, updated on node change)
      studioCost: { monthly: 0, hourly: 0, yearly: 0 },
      setStudioCost: (cost) => set({ studioCost: cost }),

      // Selected node for detail drawer
      selectedNodeId: null,
      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      // Sync state
      syncStatus: 'idle', // 'idle' | 'syncing' | 'error'
      lastSyncedAt: null,
      setSyncStatus: (status) => set({ syncStatus: status }),
      setLastSyncedAt: (t) => set({ lastSyncedAt: t }),

      // Theme
      theme: 'dark',
    }),
    {
      name: 'finops-enterprise-store',
      partialize: (s: FinOpsState) => ({
        activeView: s.activeView,
        sidebarCollapsed: s.sidebarCollapsed,
        copilotOpen: s.copilotOpen,
        copilotWidth: s.copilotWidth,
        theme: s.theme,
      }),
    }
  )
)

export default useFinOpsStore
