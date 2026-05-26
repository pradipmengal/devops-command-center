import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * useDockerIntelligenceStore — central Zustand store for the Docker Intelligence Center.
 *
 * Persisted slices (localStorage): dockerfileContent, chatHistory
 * Transient slices: analysisResults, findings, layers, securityReport,
 *                   containers, composeOutput, terminalHistory
 *
 * NOTE: AI provider settings are owned by AISettingsContext — not duplicated here.
 */
interface DockerIntelState {
  dockerfileContent: string;
  analysisResults: any;
  findings: any[];
  layers: any[];
  securityReport: any;
  chatHistory: any[];
  containers: any[];
  composeOutput: string;
  terminalHistory: any[];
  setDockerfileContent: (content: string) => void;
  setAnalysisResults: (results: any) => void;
  setFindings: (findings: any[]) => void;
  setLayers: (layers: any[]) => void;
  setSecurityReport: (report: any) => void;
  appendChatMessage: (message: any) => void;
  clearChatHistory: () => void;
  setContainers: (containers: any[]) => void;
  setComposeOutput: (output: string) => void;
  appendTerminalLine: (line: any) => void;
  resetTransientState: () => void;
}

const useDockerIntelligenceStore = create<DockerIntelState>()(
  persist(
    (set) => ({
      // ── State slices ──────────────────────────────────────────────────────

      /** Current Dockerfile content in the editor */
      dockerfileContent: '',

      /**
       * AI-derived quality metrics.
       * Shape: { securityScore, optimizationScore, layerEfficiency, buildPerformance,
       *          imageSizeEstimate, vulnerabilityCount, riskLevel, cacheEfficiency }
       */
      analysisResults: null,

      /**
       * AI-detected issues.
       * Shape: Array<{ id, severity, title, explanation, affectedLines, fix }>
       */
      findings: [],

      /**
       * Parsed layer nodes for the Layer Visualizer.
       * Shape: Array<{ id, instruction, args, estimatedSize, cacheStatus, sizeCategory }>
       */
      layers: [],

      /**
       * Security scan results.
       * Shape: { criticalCount, highCount, vulnerablePackages, fixAvailablePercent, cves: CVE[] }
       */
      securityReport: null,

      /**
       * AI Assistant conversation history (persisted).
       * Shape: Array<{ role: 'user'|'assistant', content: string, timestamp: number }>
       */
      chatHistory: [],

      /**
       * Container runtime data from the backend.
       * Shape: Array<Container>
       */
      containers: [],

      /** Generated docker-compose.yml content */
      composeOutput: '',

      /** Streaming terminal command history */
      terminalHistory: [],

      // ── Actions ───────────────────────────────────────────────────────────

      /**
       * Set Dockerfile content.
       * Side effect: clears analysisResults, findings, and layers
       * to prevent stale analysis data from being shown alongside new content.
       */
      setDockerfileContent: (content) =>
        set({
          dockerfileContent: content,
          analysisResults: null,
          findings: [],
          layers: [],
        }),

      /** Update AI analysis metrics */
      setAnalysisResults: (results) => set({ analysisResults: results }),

      /** Replace the full findings list */
      setFindings: (findings) => set({ findings }),

      /** Replace the full layers list */
      setLayers: (layers) => set({ layers }),

      /** Update the security scan report */
      setSecurityReport: (report) => set({ securityReport: report }),

      /**
       * Append a message to the chat history.
       * Keeps the full history in the store; the AI Assistant component
       * is responsible for sending only the last 8 messages to the backend.
       */
      appendChatMessage: (message) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, message],
        })),

      /** Clear the entire chat history */
      clearChatHistory: () => set({ chatHistory: [] }),

      /** Replace the containers list */
      setContainers: (containers) => set({ containers }),

      /** Replace the compose output */
      setComposeOutput: (output) => set({ composeOutput: output }),

      /** Append a line to the terminal history */
      appendTerminalLine: (line) =>
        set((state) => ({
          terminalHistory: [...state.terminalHistory, line],
        })),

      /** Reset all transient state (useful when navigating away and back) */
      resetTransientState: () =>
        set({
          analysisResults: null,
          findings: [],
          layers: [],
          securityReport: null,
          containers: [],
          composeOutput: '',
          terminalHistory: [],
        }),
    }),
    {
      name: 'docker-intelligence-store',
      // Only persist the Dockerfile content and chat history across page reloads.
      // All other state is transient and should be re-fetched/re-computed.
      partialize: (state: DockerIntelState) => ({
        dockerfileContent: state.dockerfileContent,
        chatHistory: state.chatHistory,
      }),
    }
  )
)

export default useDockerIntelligenceStore
