import { useState, useCallback, useRef } from 'react'
import { ThemeProvider } from '../context/ThemeContext'
import useTerraformStore from '../store/useTerraformStore'
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions'
import { AZURE_DEFINITIONS } from '../data/azureDefinitions'
import { GCP_DEFINITIONS } from '../data/gcpDefinitions'
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions'
import {
  CROSSPLANE_DEFINITIONS,
  CROSSPLANE_AWS_DEFINITIONS,
  CROSSPLANE_AZURE_DEFINITIONS,
  CROSSPLANE_GCP_DEFINITIONS,
} from '../data/crossplaneDefinitions'
import ResourcePalette from '../components/terraform/ResourcePalette'
import Canvas from '../components/terraform/Canvas'
import ConfigPanel from '../components/terraform/ConfigPanel'
import CodePanel from '../components/terraform/CodePanel'
import CostPanel from '../components/terraform/CostPanel'
import SecurityPanel from '../components/terraform/SecurityPanel'
import DiffPanel from '../components/terraform/DiffPanel'
import Toolbar from '../components/terraform/Toolbar'
import BlueprintModal from '../components/terraform/BlueprintModal'
import TemplatesModal from '../components/terraform/TemplatesModal'
import DiagramScanModal from '../components/terraform/DiagramScanModal'

const ALL_DEFINITIONS = {
  aws: RESOURCE_DEFINITIONS,
  azure: AZURE_DEFINITIONS,
  gcp: GCP_DEFINITIONS,
  ansible: ANSIBLE_DEFINITIONS,
  crossplane: [
    ...CROSSPLANE_DEFINITIONS,
    ...CROSSPLANE_AWS_DEFINITIONS,
    ...CROSSPLANE_AZURE_DEFINITIONS,
    ...CROSSPLANE_GCP_DEFINITIONS,
  ],
}

let idCounter = 1

export default function TerraformBuilderPage() {
  const { addNode, selectedNodeId, cloudProvider } = useTerraformStore()
  const [draggedDefinition, setDraggedDefinition] = useState(null)
  const [showBlueprints, setShowBlueprints] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showDiagramScan, setShowDiagramScan] = useState(false)
  const [bottomTab, setBottomTab] = useState('code')
  const blueprintOffset = useRef(1000)

  const handleDragStart = useCallback((e, definition) => {
    e.dataTransfer.setData('application/resourceLabel', definition.label)
    e.dataTransfer.setData('application/resourceType', definition.type)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggedDefinition(definition)
  }, [])

  const handleDrop = useCallback(
    (e, rfInstance) => {
      const label = e.dataTransfer.getData('application/resourceLabel')
      const type = e.dataTransfer.getData('application/resourceType')
      if (!label && !type) return

      const providerDefs =
        ALL_DEFINITIONS[cloudProvider] ?? RESOURCE_DEFINITIONS
      const definition =
        providerDefs.find((d) => d.label === label) ??
        providerDefs.find((d) => d.type === type)

      if (!definition) return

      const position = rfInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })
      const id = `node_${idCounter++}`

      const defaultConfig = {}
      definition.fields.forEach((f) => {
        if (f.default !== undefined) defaultConfig[f.key] = f.default
      })

      const cleanName = definition.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')

      addNode({
        id,
        type: 'resourceNode',
        position,
        data: {
          resourceType: definition.type,
          resourceName: `${cleanName}_${idCounter - 1}`,
          config: defaultConfig,
          definition,
        },
      })

      setDraggedDefinition(null)
    },
    [addNode, cloudProvider],
  )

  const handleOpenBlueprints = useCallback(() => setShowBlueprints(true), [])

  return (
    <ThemeProvider>
    <div className="flex flex-col h-full">
      <Toolbar
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenDiagramScan={() => setShowDiagramScan(true)}
      />

      <div className="flex flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
        <ResourcePalette onDragStart={handleDragStart} onOpenBlueprints={handleOpenBlueprints} />

        <Canvas
          onDrop={handleDrop}
          onOpenBlueprints={handleOpenBlueprints}
        />

        {selectedNodeId ? (
          <div className="w-80 flex-shrink-0 border-l border-gray-800/60 flex flex-col bg-gray-950/90">
            <div className="flex-1 overflow-y-auto">
              <ConfigPanel />
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-0 left-72 right-0 h-1/3 border-t border-gray-800/60 flex flex-col bg-gray-950/95">
          <div className="flex border-b border-gray-800/60 bg-gray-900/50">
            {[
              { id: 'code', label: 'Code', icon: '</>' },
              { id: 'cost', label: 'Cost', icon: '$' },
              { id: 'security', label: 'Security', icon: '!' },
              { id: 'diff', label: 'Diff', icon: '±' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setBottomTab(tab.id)}
                className={`px-4 py-2 text-[11px] font-medium transition-colors ${
                  bottomTab === tab.id
                    ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {bottomTab === 'code' && <CodePanel />}
            {bottomTab === 'cost' && <CostPanel />}
            {bottomTab === 'security' && <SecurityPanel />}
            {bottomTab === 'diff' && <DiffPanel />}
          </div>
        </div>
      </div>

      {showBlueprints && (
        <BlueprintModal onClose={() => setShowBlueprints(false)} idOffset={blueprintOffset} onUsed={() => {}} />
      )}
      {showTemplates && (
        <TemplatesModal onClose={() => setShowTemplates(false)} idOffset={blueprintOffset} onUsed={() => {}} />
      )}
      {showDiagramScan && (
        <DiagramScanModal onClose={() => setShowDiagramScan(false)} />
      )}
    </div>
    </ThemeProvider>
  )
}
