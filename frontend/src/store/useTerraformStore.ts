import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow'

const MAX_HISTORY = 50

interface TerraformState {
  nodes: any[];
  edges: any[];
  selectedNodeId: string | null;
  providerRegion: string;
  providerProfile: string;
  cloudProvider: string;
  history: any[];
  historyIndex: number;
  _pendingRedo: any;
  _pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  exportCanvas: () => string;
  importCanvas: (jsonStr: string) => boolean;
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: any) => void;
  addNode: (node: any) => void;
  addBlueprint: (newNodes: any[], newEdges: any[]) => void;
  updateNodeConfig: (nodeId: string, config: any) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setProviderRegion: (region: string) => void;
  setProviderProfile: (profile: string) => void;
  setCloudProvider: (provider: string) => void;
  clearCanvas: () => void;
}

function snapshot(state: TerraformState) {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
    selectedNodeId: state.selectedNodeId,
  }
}

const useTerraformStore = create<TerraformState>()((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  providerRegion: 'us-east-1',
  providerProfile: 'default',
  cloudProvider: 'aws',

  // ── Undo / Redo ──────────────────────────────────────────────────────────
  history: [],
  historyIndex: -1,
  _pendingRedo: null,

  _pushHistory: () => {
    const state = get()
    const entry = snapshot(state)
    const history = state.history.slice(0, state.historyIndex + 1)
    history.push(entry)
    if (history.length > MAX_HISTORY) history.shift()
    set({ history, historyIndex: history.length - 1 })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < 0) return
    const entry = snapshot(get())
    const prev = history[historyIndex]
    set({
      ...prev,
      history,
      historyIndex: historyIndex - 1,
      _pendingRedo: entry,
    })
  },

  redo: () => {
    const { history, historyIndex, _pendingRedo } = get()
    if (_pendingRedo) {
      const entry = snapshot(get())
      const historyCopy = [...history, entry]
      if (historyCopy.length > MAX_HISTORY) historyCopy.shift()
      set({
        ..._pendingRedo,
        history: historyCopy,
        historyIndex: historyCopy.length - 1,
        _pendingRedo: null,
      })
    }
  },

  // ── Export / Import ──────────────────────────────────────────────────────
  exportCanvas: () => {
    const state = get()
    return JSON.stringify({
      version: 1,
      nodes: state.nodes,
      edges: state.edges,
      providerRegion: state.providerRegion,
      providerProfile: state.providerProfile,
      cloudProvider: state.cloudProvider,
    })
  },

  importCanvas: (jsonStr) => {
    try {
      const data = JSON.parse(jsonStr)
      if (!data.version) return false
      const current = snapshot(get())
      set({
        nodes: data.nodes || [],
        edges: data.edges || [],
        selectedNodeId: null,
        providerRegion: data.providerRegion || 'us-east-1',
        providerProfile: data.providerProfile || 'default',
        cloudProvider: data.cloudProvider || 'aws',
        history: [],
        historyIndex: -1,
        _pendingRedo: null,
      })
      return true
    } catch {
      return false
    }
  },

  // ── Mutations (push history before each) ──────────────────────────────────
  onNodesChange: (changes) => {
    get()._pushHistory()
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }))
  },

  onEdgesChange: (changes) => {
    get()._pushHistory()
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }))
  },

  onConnect: (connection) => {
    get()._pushHistory()
    set((state) => ({ edges: addEdge(connection, state.edges) }))
  },

  addNode: (node) => {
    get()._pushHistory()
    set((state) => ({ nodes: [...state.nodes, node] }))
  },

  addBlueprint: (newNodes, newEdges) => {
    get()._pushHistory()
    set((state) => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges],
    }))
  },

  updateNodeConfig: (nodeId, config) => {
    get()._pushHistory()
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } }
          : n
      ),
    }))
  },

  updateNodeName: (nodeId, name) => {
    get()._pushHistory()
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, resourceName: name } } : n
      ),
    }))
  },

  deleteNode: (nodeId) => {
    get()._pushHistory()
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }))
  },

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setProviderRegion: (region) => set({ providerRegion: region }),
  setProviderProfile: (profile) => set({ providerProfile: profile }),
  setCloudProvider: (provider) => {
    get()._pushHistory()
    set({ cloudProvider: provider, nodes: [], edges: [], selectedNodeId: null })
  },
  clearCanvas: () => {
    get()._pushHistory()
    set({ nodes: [], edges: [], selectedNodeId: null })
  },
}))

export default useTerraformStore
