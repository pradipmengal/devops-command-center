import React, { useMemo, useState, useCallback } from 'react'
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { parseDockerfileLayers } from './utils/parseDockerfileLayers'

// ── Custom node component ─────────────────────────────────────────────────────

function LayerNode({ data }) {
  const { instruction, args, estimatedSize, cacheStatus, sizeCategory, heatmapMode } = data

  // Color based on heatmap mode
  const getNodeColor = () => {
    if (!heatmapMode) {
      return {
        border: 'border-cyan-500/40',
        bg: 'bg-gray-900/90',
        text: 'text-cyan-400',
        badge: 'bg-cyan-500/15 text-cyan-300',
      }
    }
    switch (sizeCategory) {
      case 'large':
        return {
          border: 'border-red-500/60',
          bg: 'bg-red-950/60',
          text: 'text-red-400',
          badge: 'bg-red-500/20 text-red-300',
        }
      case 'medium':
        return {
          border: 'border-amber-500/60',
          bg: 'bg-amber-950/60',
          text: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300',
        }
      default:
        return {
          border: 'border-cyan-500/40',
          bg: 'bg-cyan-950/40',
          text: 'text-cyan-400',
          badge: 'bg-cyan-500/15 text-cyan-300',
        }
    }
  }

  const colors = getNodeColor()

  const cacheIcon = cacheStatus === 'hit' ? '✓' : cacheStatus === 'miss' ? '✗' : '?'
  const cacheColor = cacheStatus === 'hit' ? 'text-emerald-400' : cacheStatus === 'miss' ? 'text-red-400' : 'text-gray-500'

  return (
    <div
      className={`rounded-xl border backdrop-blur px-3 py-2.5 min-w-[180px] max-w-[220px] shadow-lg transition-all duration-200 hover:scale-105 ${colors.border} ${colors.bg}`}
      title={`${instruction} ${args}\nSize: ${estimatedSize}\nCache: ${cacheStatus}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !border-gray-500 !w-2 !h-2" />

      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold font-mono ${colors.text}`}>{instruction}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${colors.badge}`}>
          {estimatedSize}
        </span>
        <span className={`text-[10px] font-bold ml-auto ${cacheColor}`} title={`Cache: ${cacheStatus}`}>
          {cacheIcon}
        </span>
      </div>

      <p className="text-[10px] text-gray-400 font-mono truncate leading-tight" title={args}>
        {args || '(no args)'}
      </p>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !border-gray-500 !w-2 !h-2" />
    </div>
  )
}

const nodeTypes = { layerNode: LayerNode }

// ── Main component ────────────────────────────────────────────────────────────

/**
 * LayerVisualizer — interactive ReactFlow diagram of Docker image layers.
 *
 * Props:
 *   dockerfileContent: string
 */
export default function LayerVisualizer({ dockerfileContent }) {
  const [heatmapMode, setHeatmapMode] = useState(false)

  // Derive nodes and edges from Dockerfile content
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const layers = parseDockerfileLayers(dockerfileContent || '')

    const nodes = layers.map((layer, index) => ({
      id: layer.id,
      type: 'layerNode',
      position: { x: 60, y: index * 90 },
      data: {
        ...layer,
        heatmapMode,
      },
    }))

    const edges = layers.slice(0, -1).map((layer, index) => ({
      id: `edge-${index}`,
      source: layer.id,
      target: layers[index + 1].id,
      type: 'smoothstep',
      style: {
        stroke: heatmapMode ? '#6b7280' : '#22d3ee',
        strokeWidth: 1.5,
        opacity: 0.6,
      },
      animated: false,
    }))

    return { nodes, edges }
  }, [dockerfileContent, heatmapMode])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  // Re-sync nodes when content or heatmap mode changes
  const syncedNodes = useMemo(() => {
    return initialNodes.map(n => ({
      ...n,
      data: { ...n.data, heatmapMode },
    }))
  }, [initialNodes, heatmapMode])

  if (!dockerfileContent || !dockerfileContent.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center bg-gray-900/40 rounded-xl border border-gray-700/30">
        <div className="text-3xl mb-2">📦</div>
        <p className="text-xs text-gray-500">Paste a Dockerfile to visualize layers</p>
      </div>
    )
  }

  if (syncedNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-center bg-gray-900/40 rounded-xl border border-gray-700/30">
        <p className="text-xs text-gray-500">No parseable instructions found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-300">📦 Layer Graph</h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/40 text-gray-500">
            {syncedNodes.length} layers
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Heatmap legend */}
          {heatmapMode && (
            <div className="flex items-center gap-2 text-[9px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />small</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />medium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />large</span>
            </div>
          )}
          <button
            onClick={() => setHeatmapMode(m => !m)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border
              ${heatmapMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-gray-800/60 text-gray-400 border-gray-700/40 hover:text-gray-200'
              }`}
          >
            🌡️ Heatmap
          </button>
        </div>
      </div>

      {/* ReactFlow canvas */}
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={syncedNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          <Background
            color="#1f2937"
            gap={20}
            size={1}
            style={{ opacity: 0.4 }}
          />
          <Controls
            style={{
              background: 'rgba(17, 24, 39, 0.8)',
              border: '1px solid rgba(75, 85, 99, 0.4)',
              borderRadius: '8px',
            }}
          />
        </ReactFlow>
      </div>

      {/* Cache legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-700/40 bg-gray-900/60 text-[9px] text-gray-500">
        <span className="font-semibold text-gray-400">Cache:</span>
        <span className="flex items-center gap-1"><span className="text-emerald-400 font-bold">✓</span> hit</span>
        <span className="flex items-center gap-1"><span className="text-red-400 font-bold">✗</span> miss</span>
        <span className="flex items-center gap-1"><span className="text-gray-500 font-bold">?</span> unknown</span>
      </div>
    </div>
  )
}
