import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow'
import 'reactflow/dist/style.css'
import axios from 'axios'
import ContainerNode from './ContainerNode'

const nodeTypes = { containerNode: ContainerNode }

const DRIVER_COLORS = {
  bridge:  '#22d3ee',
  host:    '#a855f7',
  overlay: '#3b82f6',
  macvlan: '#22c55e',
  none:    '#6b7280',
}

function forceLayout(nodes, edges, width, height) {
  const positions = {}
  const center = { x: width / 2, y: height / 2 }

  if (nodes.length === 0) return positions
  if (nodes.length === 1) {
    positions[nodes[0].id] = { x: center.x, y: center.y }
    return positions
  }

  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    const radius = Math.min(width, height) * 0.35
    positions[node.id] = {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    }
  })

  const iterations = 80
  for (let iter = 0; iter < iterations; iter++) {
    const forces = {}
    nodes.forEach(n => { forces[n.id] = { x: 0, y: 0 } })
    const damping = 1 - iter / iterations

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i].id]
        const b = positions[nodes[j].id]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const force = 8000 / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        forces[nodes[i].id].x += fx
        forces[nodes[i].id].y += fy
        forces[nodes[j].id].x -= fx
        forces[nodes[j].id].y -= fy
      }
    }

    edges.forEach(edge => {
      const a = positions[edge.source]
      const b = positions[edge.target]
      if (!a || !b) return
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const force = dist * 0.005
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      forces[edge.source].x -= fx
      forces[edge.source].y -= fy
      forces[edge.target].x += fx
      forces[edge.target].y += fy
    })

    nodes.forEach(n => {
      const pos = positions[n.id]
      forces[n.id].x += (center.x - pos.x) * 0.002
      forces[n.id].y += (center.y - pos.y) * 0.002
    })

    nodes.forEach(n => {
      positions[n.id].x += forces[n.id].x * damping
      positions[n.id].y += forces[n.id].y * damping
    })
  }

  return positions
}

export default function NetworkTopologyMap() {
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const draggedPositions = useRef({})

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get('/api/docker-networking/topology')
      if (data.status === 'success') setNetworks(data.data)
      else setError(data.message)
    } catch (e) {
      setError(e.response?.data?.message ?? e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [])

  const layout = useMemo(() => {
    const containerMap = new Map()
    const edgeSet = new Set()

    networks.forEach(net => {
      const containers = net.containers || []
      containers.forEach(c => {
        if (!containerMap.has(c.id)) {
          containerMap.set(c.id, {
            id: c.id,
            name: c.name,
            ip: c.ip,
            networks: [],
          })
        }
        const entry = containerMap.get(c.id)
        if (!entry.networks.includes(net.name)) {
          entry.networks.push(net.name)
        }
      })

      for (let i = 0; i < containers.length; i++) {
        for (let j = i + 1; j < containers.length; j++) {
          const edgeKey = [containers[i].id, containers[j].id].sort().join('-')
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey)
          }
        }
      }
    })

    const containerList = Array.from(containerMap.values())

    const flowNodes = containerList.map(c => ({
      id: c.id,
      type: 'containerNode',
      data: {
        name: c.name,
        ip: c.ip,
        containerId: c.id.slice(0, 12),
        networks: c.networks,
      },
    }))

    const flowEdges = Array.from(edgeSet).map(key => {
      const [source, target] = key.split('-')
      const sharedNets = networks.filter(net =>
        net.containers?.some(c => c.id === source) &&
        net.containers?.some(c => c.id === target)
      )
      const driver = sharedNets[0]?.driver || 'bridge'
      const color = DRIVER_COLORS[driver] || '#6b7280'

      return {
        id: key,
        source,
        target,
        type: 'smoothstep',
        animated: true,
        style: { stroke: color, strokeWidth: 2, opacity: 0.6 },
        label: sharedNets.map(n => n.name).join(', '),
        labelStyle: { fill: '#9ca3af', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#1f2937', fillOpacity: 0.85, rx: 4 },
      }
    })

    const positions = forceLayout(flowNodes, flowEdges, 800, 500)
    flowNodes.forEach(n => {
      const dragged = draggedPositions.current[n.id]
      n.position = dragged || positions[n.id] || { x: 400, y: 250 }
    })

    return { nodes: flowNodes, edges: flowEdges }
  }, [networks])

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)
  const [activeEdges, setActiveEdges] = useState<Set<string>>(new Set())
  const [trafficSource, setTrafficSource] = useState<string | null>(null)
  const trafficTimerRef = useRef<number>()

  const simulateTraffic = useCallback((sourceId: string) => {
    if (layout.edges.length === 0) return

    // Build adjacency and edge lookup from layout data
    const adj = new Map<string, string[]>()
    const edgeLookup = new Map<string, string>()
    layout.edges.forEach(e => {
      if (!adj.has(e.source)) adj.set(e.source, [])
      if (!adj.has(e.target)) adj.set(e.target, [])
      adj.get(e.source)!.push(e.target)
      adj.get(e.target)!.push(e.source)
      const key = [e.source, e.target].sort().join('-')
      edgeLookup.set(key, e.id)
    })

    // BFS to group edges by hop level
    const queue: [string, number][] = [[sourceId, 0]]
    const visited = new Set([sourceId])
    const levelEdges: string[][] = []

    while (queue.length > 0) {
      const [current, level] = queue.shift()!
      if (!levelEdges[level]) levelEdges[level] = []

      const neighbors = adj.get(current) || []
      neighbors.forEach(n => {
        if (visited.has(n)) return
        visited.add(n)
        queue.push([n, level + 1])

        const edgeKey = [current, n].sort().join('-')
        const eid = edgeLookup.get(edgeKey)
        if (eid && !levelEdges[level].includes(eid)) {
          levelEdges[level].push(eid)
        }
      })
    }

    // Clear running animation
    if (trafficTimerRef.current) clearTimeout(trafficTimerRef.current)
    setActiveEdges(new Set())
    setTrafficSource(sourceId)

    // Cascade: highlight edges level by level
    const delay = 500
    levelEdges.forEach((edgeIds, level) => {
      setTimeout(() => {
        setActiveEdges(prev => {
          const next = new Set(prev)
          edgeIds.forEach(id => next.add(id))
          return next
        })
      }, (level + 1) * delay)
    })

    // Reset after all levels complete
    const totalTime = (levelEdges.length + 1) * delay + 1500
    trafficTimerRef.current = setTimeout(() => {
      setActiveEdges(new Set())
      setTrafficSource(null)
    }, totalTime)
  }, [layout.edges])

  const displayEdges = useMemo(() => {
    if (activeEdges.size === 0) return edges
    return edges.map(e => {
      if (activeEdges.has(e.id)) {
        return {
          ...e,
          animated: true,
          style: { stroke: '#22c55e', strokeWidth: 3.5, opacity: 1 },
        }
      }
      return e
    })
  }, [edges, activeEdges])

  const handleNodeClick = useCallback((_, node) => {
    simulateTraffic(node.id)
  }, [simulateTraffic])

  const handleNodesChange = useCallback(changes => {
    changes.forEach(change => {
      if (change.type === 'position' && change.position && change.dragging !== true) {
        draggedPositions.current[change.id] = change.position
      }
    })
    onNodesChange(changes)
  }, [onNodesChange])

  // Sync when layout changes (new API data) while preserving dragged positions
  useEffect(() => {
    Object.keys(draggedPositions.current).forEach(id => {
      if (!layout.nodes.some(n => n.id === id)) {
        delete draggedPositions.current[id]
      }
    })
    setNodes(layout.nodes)
  }, [layout.nodes])

  // Keep edges in sync
  useEffect(() => {
    setEdges(layout.edges)
  }, [layout.edges])

  if (error) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-red-400 bg-gray-900/40 rounded-xl border border-gray-700/30">
        {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/40 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-300">🕸️ Network Topology Map</h3>
          {!loading && nodes.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700/40 text-gray-500">
              {nodes.length} container{nodes.length !== 1 ? 's' : ''}
            </span>
          )}
          {trafficSource && (
            <span className="flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Tracing: {trafficSource.slice(0, 12)}…
            </span>
          )}
        </div>
        <button
          onClick={fetch}
          disabled={loading}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700/40 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all disabled:opacity-40"
        >
          {loading ? '⟳ Loading…' : '↻ Refresh'}
        </button>
      </div>

      <div className="h-[500px]">
        {loading && nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            Loading topology…
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500">
            No containers connected to any network
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            style={{ background: 'transparent' }}
          >
            <Background color="#1f2937" gap={20} size={1} style={{ opacity: 0.4 }} />
            <Controls
              style={{
                background: 'rgba(17, 24, 39, 0.8)',
                border: '1px solid rgba(75, 85, 99, 0.4)',
                borderRadius: '8px',
              }}
            />
            <MiniMap
              nodeColor={() => '#22d3ee'}
              style={{
                background: 'rgba(10,16,30,0.9)',
                border: '1px solid rgba(75,85,99,0.3)',
                borderRadius: 8,
              }}
            />
          </ReactFlow>
        )}
      </div>

      {nodes.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-700/40 bg-gray-900/60 text-[9px] text-gray-500">
          <span className="font-semibold text-gray-400">Legend:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-cyan-400 inline-block" /> bridge</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-purple-400 inline-block" /> host</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-blue-400 inline-block" /> overlay</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-green-400 inline-block" /> macvlan</span>
        </div>
      )}
    </div>
  )
}
