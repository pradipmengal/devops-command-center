import { memo } from 'react'
import { Handle, Position } from 'reactflow'

function ContainerNode({ data }) {
  const { name, ip, containerId, networks } = data

  return (
    <div className="rounded-xl border border-emerald-500/40 bg-gray-900/90 backdrop-blur px-4 py-3 min-w-[180px] shadow-lg hover:border-emerald-400/60 transition-all duration-200 select-none cursor-pointer"
      title="Click to simulate traffic propagation"
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !border-gray-500 !bg-gray-600" />

      <div className="flex items-center gap-2.5 mb-1.5">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-sm border border-emerald-500/20 shrink-0">
          🖥️
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-200 truncate leading-tight">{name}</p>
          <p className="text-[10px] font-mono text-gray-500 truncate">{containerId}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] font-mono bg-gray-800/60 rounded-lg px-2 py-1 mb-1.5">
        <span className="text-emerald-400 text-[8px]">●</span>
        <span className="text-gray-300">{ip || '—'}</span>
      </div>

      {networks && networks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {networks.map(net => (
            <span
              key={net}
              className="text-[8px] px-1.5 py-0.5 rounded-full bg-gray-800/80 text-gray-400 border border-gray-700/50 font-medium"
            >
              {net}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !border-gray-500 !bg-gray-600" />
    </div>
  )
}

export default memo(ContainerNode)
