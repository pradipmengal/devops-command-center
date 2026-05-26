import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionLineType,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Zap } from 'lucide-react';
import useTerraformStore from '../../store/useTerraformStore';
import ResourceNode from './ResourceNode';
import { RESOURCE_DEFINITIONS } from '../../data/resourceDefinitions';

const nodeTypes = { resourceNode: ResourceNode };

const PORT_EDGE_COLORS = {
  'bg-cyan-400':    '#22d3ee',
  'bg-red-400':     '#f87171',
  'bg-pink-400':    '#f472b6',
  'bg-blue-400':    '#60a5fa',
  'bg-orange-400':  '#fb923c',
  'bg-purple-400':  '#c084fc',
  'bg-yellow-400':  '#facc15',
  'bg-green-400':   '#4ade80',
  'bg-teal-400':    '#2dd4bf',
  'bg-indigo-400':  '#818cf8',
};

function getEdgeColor(sourceNodeId, sourceHandleId, nodes) {
  const node = nodes.find((n) => n.id === sourceNodeId);
  if (!node) return '#6b7280';
  const port = node.data.definition.ports.find((p) => p.id === sourceHandleId);
  if (!port) return '#6b7280';
  return PORT_EDGE_COLORS[port.color] ?? '#6b7280';
}

export default function Canvas({ onDrop, onOpenBlueprints }) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useTerraformStore();
  const rfInstanceRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      if (rfInstanceRef.current) onDrop(e, rfInstanceRef.current);
    },
    [onDrop]
  );

  const handleConnect = useCallback(
    (connection) => {
      const color = getEdgeColor(connection.source ?? '', connection.sourceHandle, nodes);
      const portLabel = (() => {
        const node = nodes.find((n) => n.id === connection.source);
        const port = node?.data.definition.ports.find((p) => p.id === connection.sourceHandle);
        return port?.label ?? '';
      })();

      const enrichedEdge = {
        id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}-${Date.now()}`,
        source: connection.source ?? '',
        target: connection.target ?? '',
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'smoothstep',
        animated: true,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        label: portLabel,
        labelStyle: { fill: '#9ca3af', fontSize: 10 },
        labelBgStyle: { fill: '#1f2937', fillOpacity: 0.8 },
      };
      onConnect(enrichedEdge);
    },
    [nodes, onConnect]
  );

  return (
    <div className="flex-1 h-full canvas-bg" style={{ minHeight: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={(instance) => { rfInstanceRef.current = instance; }}
        nodeTypes={nodeTypes}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        deleteKeyCode="Delete"
        className="canvas-bg"
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6b7280', strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(99,102,241,0.15)"
        />
        <Controls className="bg-gray-800 border-gray-600" />
        <MiniMap
          nodeColor={(node) => {
            const colorMap = {
              'border-orange-500': '#f97316',
              'border-green-500':  '#22c55e',
              'border-blue-500':   '#3b82f6',
              'border-cyan-500':   '#06b6d4',
              'border-red-500':    '#ef4444',
              'border-purple-500': '#a855f7',
              'border-yellow-500': '#eab308',
              'border-pink-500':   '#ec4899',
              'border-teal-500':   '#14b8a6',
              'border-indigo-500': '#6366f1',
            };
            return colorMap[node.data?.definition?.borderColor] ?? '#6b7280';
          }}
          style={{
            background: 'rgba(10,16,30,0.9)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 12,
          }}
        />

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center fade-in">
              <div className="relative inline-block mb-6">
                <div
                  className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mx-auto"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(56,189,248,0.1) 100%)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    boxShadow: '0 0 60px rgba(99,102,241,0.15), 0 0 120px rgba(56,189,248,0.08)',
                  }}
                >
                  🏗️
                </div>
              </div>

              <h3
                className="text-2xl font-bold mb-2"
                style={{
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Start Building Your Infrastructure
              </h3>
              <p className="text-gray-600 text-sm max-w-xs mx-auto mb-6 leading-relaxed">
                Drag resources from the left panel, or use Quick Setup to scaffold a full stack instantly.
              </p>

              <div className="pointer-events-auto flex flex-col items-center gap-3">
                <button
                  onClick={onOpenBlueprints}
                  className="flex items-center gap-2.5 font-semibold px-6 py-3 rounded-2xl text-sm transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                    color: 'white',
                  }}
                >
                  <Zap size={16} className="text-yellow-300" />
                  Quick Setup — pick a blueprint
                </button>
                <p className="text-gray-700 text-xs">or drag resources from the left panel</p>
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {RESOURCE_DEFINITIONS.slice(0, 5).map((d) => (
                  <span
                    key={d.type}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#475569',
                    }}
                  >
                    {d.icon} {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}
