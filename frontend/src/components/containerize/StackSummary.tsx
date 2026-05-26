import React from 'react'

export default function StackSummary({ stack }) {
  if (!stack) return null

  return (
    <div className="rounded-2xl bg-gray-900/80 border border-gray-700/40 overflow-hidden shadow-xl shadow-black/20">
      <div className="px-4 py-3 border-b border-gray-700/40 bg-gray-800/40">
        <span className="text-xs text-gray-500 font-medium">Detected Stack</span>
      </div>
      <div className="p-4 space-y-4">
        {stack.languages?.length > 0 && (
          <Section title="Languages" items={stack.languages} color="indigo" />
        )}
        {stack.frameworks?.length > 0 && (
          <Section title="Frameworks" items={stack.frameworks} color="cyan" />
        )}
        {stack.databases?.length > 0 && (
          <Section title="Databases" items={stack.databases} color="amber" />
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          {stack.build_tool && (
            <div className="px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <span className="text-gray-600">Build Tool</span>
              <p className="text-gray-200 font-medium mt-0.5">{stack.build_tool}</p>
            </div>
          )}
          {stack.port && (
            <div className="px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <span className="text-gray-600">Exposed Port</span>
              <p className="text-gray-200 font-medium mt-0.5">{stack.port}</p>
            </div>
          )}
          {stack.package_manager && (
            <div className="px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <span className="text-gray-600">Package Manager</span>
              <p className="text-gray-200 font-medium mt-0.5">{stack.package_manager}</p>
            </div>
          )}
          {stack.docker_base_image && (
            <div className="px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/30">
              <span className="text-gray-600">Base Image</span>
              <p className="text-gray-200 font-medium mt-0.5 text-[10px] break-all">{stack.docker_base_image}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {stack.has_dockerfile && <Badge icon="🐳">Dockerfile exists</Badge>}
          {stack.has_compose && <Badge icon="🐙">Compose exists</Badge>}
          {stack.has_k8s && <Badge icon="☸️">K8s manifests exist</Badge>}
          {stack.has_helm && <Badge icon="⛑️">Helm chart exists</Badge>}
          {stack.env_files?.length > 0 && <Badge icon="🔑">Env files found</Badge>}
        </div>
      </div>
    </div>
  )
}

function Section({ title, items, color }) {
  const colors = { indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/20', cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20', amber: 'bg-amber-500/15 text-amber-300 border-amber-500/20' }
  const dotColors = { indigo: 'bg-indigo-500', cyan: 'bg-cyan-500', amber: 'bg-amber-500' }
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColors[color]}`} />
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className={`text-[11px] px-2 py-0.5 rounded-full border ${colors[color]}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function Badge({ icon, children }) {
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800/50 border border-gray-700/40 text-gray-400">
      <span className="text-xs">{icon}</span>
      <span>{children}</span>
    </span>
  )
}
