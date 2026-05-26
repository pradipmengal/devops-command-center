# Terraform Visual Builder — Integration Plan

> **Date:** 2026-05-22
> **Source:** `C:\Users\Pradip\Downloads\kiro\visual\terraform-visual-builder`
> **Target:** `C:\Users\Pradip\Downloads\kiro\devops-command-center`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Source App Analysis](#2-source-app-analysis)
3. [Target App Analysis](#3-target-app-analysis)
4. [Dependency Compatibility Matrix](#4-dependency-compatibility-matrix)
5. [Complete File Mapping](#5-complete-file-mapping)
6. [Phase 1: Core Structure Setup](#6-phase-1-core-structure-setup)
7. [Phase 2: Data Layer Port](#7-phase-2-data-layer-port)
8. [Phase 3: Store Port](#8-phase-3-store-port)
9. [Phase 4: Utility Port](#9-phase-4-utility-port)
10. [Phase 5: Component Port](#10-phase-5-component-port)
11. [Phase 6: Integration & Wiring](#11-phase-6-integration--wiring)
12. [Phase 7: Backend Enhancement](#12-phase-7-backend-enhancement)
13. [Phase 8: AI Integration](#13-phase-8-ai-integration)
14. [TypeScript → JavaScript Conversion Guide](#14-typescript--javascript-conversion-guide)
15. [Style & Theme Integration](#15-style--theme-integration)
16. [Testing & Verification](#16-testing--verification)
17. [Future Enhancements](#17-future-enhancements)
18. [Architecture Diagram](#18-architecture-diagram)

---

## 1. Overview

This document outlines the complete plan for integrating the **Terraform Visual Builder** (a standalone React+TypeScript SPA) into the **DevOps Command Center** (an existing React+JavaScript SPA with a FastAPI backend).

The visual builder is a drag-and-drop infrastructure-as-code designer supporting **AWS, Azure, GCP, Ansible, and Crossplane** resource types. It features real-time HCL code generation, cost estimation, security auditing, and diagram scanning.

### Integration Strategy

The integration follows a **direct source port** approach — converting TypeScript files to JavaScript and placing them into the existing DevOps Command Center frontend. The core ReactFlow visual canvas becomes a new route (`/terraform-builder`) in the existing app shell.

---

## 2. Source App Analysis

**Location:** `C:\Users\Pradip\Downloads\kiro\visual\terraform-visual-builder`

### 2.1 Tech Stack

| Category | Technology | Version |
|---|---|---|
| Framework | React | ^18.2.0 |
| Language | TypeScript | ^5.0.2 |
| Build Tool | Vite | ^4.4.5 |
| CSS | Tailwind CSS | ^3.4.19 |
| State | Zustand | ^5.0.12 |
| Visual Canvas | ReactFlow | ^11.11.4 |
| Code Editor | Monaco Editor | ^4.7.0 |
| Icons | lucide-react | ^1.14.0 |
| ZIP | JSZip | ^3.10.1 |
| PDF | pdfjs-dist | ^5.4.624 |
| OCR | tesseract.js | ^7.0.0 |
| Panels | react-resizable-panels | ^4.11.0 |

### 2.2 Project Structure

```
terraform-visual-builder/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── src/
    ├── main.tsx                    # Entry point
    ├── App.tsx                     # Root layout + drag-drop logic
    ├── App.css                     # Global styles
    ├── index.css                   # Theme CSS variables
    ├── vite-env.d.ts
    ├── types/
    │   └── resources.ts            # Type definitions (ResourceType, ResourceDefinition, ResourceNodeData)
    ├── context/
    │   └── ThemeContext.tsx         # Dark/light theme
    ├── store/
    │   └── useStore.ts             # Zustand store (nodes, edges, provider selection)
    ├── data/
    │   ├── resourceDefinitions.ts  # AWS: ~75 resource definitions (1830 lines)
    │   ├── azureDefinitions.ts     # Azure resource definitions (325 lines)
    │   ├── gcpDefinitions.ts       # GCP resource definitions
    │   ├── ansibleDefinitions.ts   # Ansible task definitions
    │   ├── crossplaneDefinitions.ts # Crossplane definitions
    │   ├── dependencies.ts         # AWS dependency relationships (480 lines)
    │   ├── multiCloudDependencies.ts # Azure/GCP/Ansible/Crossplane deps
    │   ├── blueprints.ts           # Quick Setup blueprints
    │   └── architectureTemplates.ts # Architecture templates
    ├── utils/
    │   ├── terraformGenerator.ts   # AWS HCL code generator (1281 lines)
    │   ├── azureGenerator.ts       # Azure HCL generator
    │   ├── gcpGenerator.ts         # GCP HCL generator
    │   ├── ansibleGenerator.ts     # Ansible YAML generator
    │   ├── crossplaneGenerator.ts  # Crossplane K8s YAML generator
    │   ├── costEstimator.ts        # AWS cost engine (225 lines)
    │   ├── securityAudit.ts        # AWS security audit (296 lines)
    │   ├── diagramScanner.ts       # OCR + text parsing
    │   ├── diagramParser.ts        # Draw.io XML parser
    │   ├── multiFileExport.ts      # Multi-file project ZIP
    │   └── envGenerator.ts         # Environment-based export
    └── components/
        ├── Header.tsx              # Toolbar: region, profile, templates, theme
        ├── Sidebar.tsx             # Left panel: mode, cloud, search, resource palette (554 lines)
        ├── Canvas.tsx              # ReactFlow canvas (217 lines)
        ├── ResourceNode.tsx        # Custom ReactFlow node (212 lines)
        ├── ConfigPanel.tsx         # Right-side resource config (206 lines)
        ├── CodePanel.tsx           # Monaco code viewer (425 lines)
        ├── CostPanel.tsx           # Cost estimation panel
        ├── SecurityPanel.tsx       # Security audit panel
        ├── DiffPanel.tsx           # Code diff panel
        ├── SuggestionPanel.tsx     # Smart dependency suggestions (420 lines)
        ├── BlueprintModal.tsx      # Quick Setup modal
        ├── TemplatesModal.tsx      # Architecture templates modal
        └── DiagramScanModal.tsx    # Diagram scan/upload modal
```

### 2.3 Key Features

| Feature | Description |
|---|---|
| **Visual Canvas** | Drag-and-drop ReactFlow canvas with custom resource nodes, edge connections with port labels and colors |
| **Multi-Provider** | AWS (75+ resources), Azure (30+), GCP, Ansible, Crossplane — all with per-provider HCL/YAML generation |
| **Smart Suggestions** | Contextual dependency suggestions when a resource is selected; one-click add-missing-dependencies |
| **Code Generation** | Real-time HCL generation (main.tf, variables.tf, outputs.tf, providers.tf), env-based multi-file generation |
| **Cost Estimation** | Static AWS pricing table, per-resource breakdown with expandable details, monthly min/max estimates |
| **Security Audit** | CIS benchmark-aligned audit rules, scoring (0-100), per-resource findings with severity levels |
| **Diff View** | Snapshot-based LCS diff highlighting additions/removals |
| **Diagram Scanner** | Upload PNG/JPEG/PDF/Draw.io, OCR via Tesseract.js, auto-detect resources, generate HCL |
| **Blueprints** | 4 pre-built blueprints (EC2, RDS, Lambda, Web App) |
| **Templates** | 8 architecture templates (3-Tier, Serverless, EKS, VPC + VPN, ML Pipeline, CI/CD, ECS Fargate) |
| **Multi-File Export** | ZIP download with standard Terraform project structure or env-based (dev/staging/prod .tfvars) |

### 2.4 Data Flow

```
User Drags Resource
      │
      ▼
Sidebar.onDragStart → stores label+type in dataTransfer
      │
      ▼
Canvas.onDrop → App.handleDrop() → looks up definition in
ALL_DEFINITIONS[cloudProvider] → creates default config →
calls useStore.addNode()
      │
      ▼
ReactFlow re-renders nodes
      │
      ▼
CodePanel re-computes (useMemo) → terraformGenerator/azureGenerator/etc.
CostPanel → costEstimator (useMemo)
SecurityPanel → securityAudit (computed)
DiffPanel → snapshot comparison (LCS)
```

---

## 3. Target App Analysis

**Location:** `C:\Users\Pradip\Downloads\kiro\devops-command-center`

### 3.1 Tech Stack

| Category | Technology | Version |
|---|---|---|
| Framework | React | ^18.3.1 |
| Language | JavaScript (JSX) | — |
| Build Tool | Vite | ^5.3.3 |
| CSS | Tailwind CSS | ^3.4.6 |
| State | Zustand | ^5.0.13 |
| Visual Canvas | ReactFlow | ^11.11.4 |
| Code Editor | Monaco Editor | ^4.7.0 |
| Icons | lucide-react | ^1.14.0 |
| ZIP | JSZip | ^3.10.1 |
| Routing | React Router DOM | ^6.24.0 |
| HTTP | Axios | ^1.7.2 |
| Testing | Vitest | ^1.6.0 |

### 3.2 Project Structure (Relevant Parts)

```
frontend/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── nginx.conf
└── src/
    ├── main.jsx                # BrowserRouter → AISettingsProvider → App
    ├── App.jsx                 # MainLayout shell (sidebar + top bar + Routes)
    ├── index.css               # Tailwind + custom utilities (glass, gradient-border, etc.)
    ├── components/
    │   ├── Sidebar.jsx         # Collapsible nav with Primary Tools + "Other Tools" groups
    │   ├── OutputPanel.jsx     # Shared output (loading/error/content/copy)
    │   ├── AIGate.jsx          # Gated wrapper for AI-dependent features
    │   ├── AISettingsModal.jsx # AI provider config modal
    │   └── ...
    ├── pages/
    │   ├── HomePage.jsx
    │   ├── DockerIntelligencePage.jsx  # Complex page pattern (346 lines)
    │   ├── MultiCloudDashboard.jsx     # Enterprise page pattern (367 lines)
    │   ├── CloudCostPage.jsx           # 753-line dashboard
    │   └── ...
    ├── store/
    │   ├── useDockerIntelligenceStore.js  # Zustand + persist middleware
    │   ├── useFinOpsStore.js
    │   └── useFinOpsDashboardStore.js
    └── context/
        └── AISettingsContext.jsx    # AI provider config (Gemini, OpenAI, Ollama, etc.)

backend/
├── main.py              # FastAPI app, 17 router registrations
├── requirements.txt     # FastAPI, Uvicorn, Pydantic, PyYAML, OpenAI, google-generativeai
└── routes/
    ├── terraform.py     # (Mentioned in README, file not found — needs creation)
    └── ... (25+ other route files)
```

### 3.3 Routing Structure (`App.jsx`)

| Route | Page | Group |
|---|---|---|
| `/` | HomePage | — |
| `/k8s`, `/base64`, `/cron` | Original tools | — |
| `/jwt`, `/hash`, `/converter`, `/regex`, `/timestamp`, `/subnet`, `/gitignore`, `/curl`, `/uuid`, `/cicd` | New tools | — |
| `/ai-chat`, `/ai-error`, `/ai-docker` | AI Features | — |
| `/cloud-cost`, `/ssl` | Infrastructure | — |
| `/docker-intelligence` | Docker Cockpit | Primary |
| `/multi-cloud` | Multi-Cloud AI | Primary |
| `/containerize` | Containerize | Primary |

### 3.4 Existing Terraform Infrastructure

- **Backend:** README mentions `POST /terraform/generate` returning HCL snippets for 8 resource types
- **No actual terraform route file exists** (needs creation)
- **Frontend:** No Terraform page exists; the README references `TerraformPage.jsx` but it was never created
- **Existing relevant deps:** ReactFlow 11, Monaco Editor, Zustand 5, JSZip, lucide-react — all identical versions to visual builder

---

## 4. Dependency Compatibility Matrix

| Dependency | Source (visual-builder) | Target (devops-cc) | Compatible? |
|---|---|---|---|
| react | ^18.2.0 | ^18.3.1 | ✅ Same major |
| react-dom | ^18.2.0 | ^18.3.1 | ✅ Same major |
| reactflow | ^11.11.4 | ^11.11.4 | ✅ **Exact match** |
| @monaco-editor/react | ^4.7.0 | ^4.7.0 | ✅ **Exact match** |
| zustand | ^5.0.12 | ^5.0.13 | ✅ Same major |
| jszip | ^3.10.1 | ^3.10.1 | ✅ **Exact match** |
| lucide-react | ^1.14.0 | ^1.14.0 | ✅ **Exact match** |
| tailwindcss | ^3.4.19 | ^3.4.6 | ✅ Same major |
| vite | ^4.4.5 | ^5.3.3 | ✅ Different major, but this is just the build tool |
| react-router-dom | — | ^6.24.0 | ✅ Not used by visual builder |
| react-resizable-panels | ^4.11.0 | — | ⚠️ **New dep needed** |
| pdfjs-dist | ^5.4.624 | — | ⚠️ **New dep needed** |
| tesseract.js | ^7.0.0 | — | ⚠️ **New dep needed** |

**New npm packages needed (frontend `package.json`):**
```json
"react-resizable-panels": "^4.11.0",
"pdfjs-dist": "^5.4.624",
"tesseract.js": "^7.0.0"
```

**Backend new pip packages needed (`requirements.txt`):**
```txt
# No new backend deps needed — the visual builder is entirely client-side
# Optional: add `terraform-validator` or similar for backend validation
```

---

## 5. Complete File Mapping

This table maps every source file to its destination in the DevOps Command Center.

| # | Source Path (visual-builder) | Destination Path (devops-cc) | Conversion | Notes |
|---|---|---|---|---|
| **Store** | | | | |
| 1 | `src/store/useStore.ts` | `frontend/src/store/useTerraformStore.js` | TS→JS, rename | New Zustand store for visual builder state |
| **Data** | | | | |
| 2 | `src/types/resources.ts` | `frontend/src/data/terraformResources.js` | TS→JS (JSDoc) | Convert interfaces to JSDoc-annotated objects |
| 3 | `src/data/resourceDefinitions.ts` | `frontend/src/data/resourceDefinitions.js` | TS→JS | AWS resource definitions (1830 lines) |
| 4 | `src/data/azureDefinitions.ts` | `frontend/src/data/azureDefinitions.js` | TS→JS | Azure definitions |
| 5 | `src/data/gcpDefinitions.ts` | `frontend/src/data/gcpDefinitions.js` | TS→JS | GCP definitions |
| 6 | `src/data/ansibleDefinitions.ts` | `frontend/src/data/ansibleDefinitions.js` | TS→JS | Ansible definitions |
| 7 | `src/data/crossplaneDefinitions.ts` | `frontend/src/data/crossplaneDefinitions.js` | TS→JS | Crossplane definitions |
| 8 | `src/data/dependencies.ts` | `frontend/src/data/terraformDependencies.js` | TS→JS | AWS dependency map |
| 9 | `src/data/multiCloudDependencies.ts` | `frontend/src/data/multiCloudDependencies.js` | TS→JS | Azure/GCP/Ansible deps |
| 10 | `src/data/blueprints.ts` | `frontend/src/data/terraformBlueprints.js` | TS→JS | Quick Setup blueprints |
| 11 | `src/data/architectureTemplates.ts` | `frontend/src/data/architectureTemplates.js` | TS→JS | Architecture templates |
| **Utils** | | | | |
| 12 | `src/utils/terraformGenerator.ts` | `frontend/src/utils/terraformGenerator.js` | TS→JS | AWS HCL generator (1281 lines) |
| 13 | `src/utils/azureGenerator.ts` | `frontend/src/utils/azureGenerator.js` | TS→JS | Azure HCL generator |
| 14 | `src/utils/gcpGenerator.ts` | `frontend/src/utils/gcpGenerator.js` | TS→JS | GCP HCL generator |
| 15 | `src/utils/ansibleGenerator.ts` | `frontend/src/utils/ansibleGenerator.js` | TS→JS | Ansible YAML generator |
| 16 | `src/utils/crossplaneGenerator.ts` | `frontend/src/utils/crossplaneGenerator.js` | TS→JS | Crossplane YAML generator |
| 17 | `src/utils/costEstimator.ts` | `frontend/src/utils/costEstimator.js` | TS→JS | AWS cost engine |
| 18 | `src/utils/securityAudit.ts` | `frontend/src/utils/securityAudit.js` | TS→JS | Security audit engine |
| 19 | `src/utils/diagramScanner.ts` | `frontend/src/utils/diagramScanner.js` | TS→JS | OCR + text parser |
| 20 | `src/utils/diagramParser.ts` | `frontend/src/utils/diagramParser.js` | TS→JS | Draw.io XML parser |
| 21 | `src/utils/multiFileExport.ts` | `frontend/src/utils/multiFileExport.js` | TS→JS | ZIP export engine |
| 22 | `src/utils/envGenerator.ts` | `frontend/src/utils/envGenerator.js` | TS→JS | Env-based export |
| **Components** | | | | |
| 23 | `src/components/Canvas.tsx` | `frontend/src/components/terraform/Canvas.jsx` | TS→JS | ReactFlow canvas |
| 24 | `src/components/ResourceNode.tsx` | `frontend/src/components/terraform/ResourceNode.jsx` | TS→JS | Custom ReactFlow node |
| 25 | `src/components/ConfigPanel.tsx` | `frontend/src/components/terraform/ConfigPanel.jsx` | TS→JS | Resource config panel |
| 26 | `src/components/CodePanel.tsx` | `frontend/src/components/terraform/CodePanel.jsx` | TS→JS | Monaco code viewer |
| 27 | `src/components/CostPanel.tsx` | `frontend/src/components/terraform/CostPanel.jsx` | TS→JS | Cost estimation |
| 28 | `src/components/SecurityPanel.tsx` | `frontend/src/components/terraform/SecurityPanel.jsx` | TS→JS | Security audit |
| 29 | `src/components/DiffPanel.tsx` | `frontend/src/components/terraform/DiffPanel.jsx` | TS→JS | Code diff |
| 30 | `src/components/SuggestionPanel.tsx` | `frontend/src/components/terraform/SuggestionPanel.jsx` | TS→JS | Dependency suggestions (420 lines) |
| 31 | `src/components/BlueprintModal.tsx` | `frontend/src/components/terraform/BlueprintModal.jsx` | TS→JS | Quick Setup modal |
| 32 | `src/components/TemplatesModal.tsx` | `frontend/src/components/terraform/TemplatesModal.jsx` | TS→JS | Architecture templates modal |
| 33 | `src/components/DiagramScanModal.tsx` | `frontend/src/components/terraform/DiagramScanModal.jsx` | TS→JS | Diagram scan upload modal |
| 34 | `src/components/Header.tsx` | `frontend/src/components/terraform/Toolbar.jsx` | TS→JS, rename | Region, profile, templates button |
| 35 | `src/components/Sidebar.tsx` | `frontend/src/components/terraform/ResourcePalette.jsx` | TS→JS, rename | Resource palette (554 lines) |
| **Page** | | | | |
| 36 | `src/App.tsx` (layout logic) | `frontend/src/pages/TerraformBuilderPage.jsx` | TS→JS, restructure | New page (combines App.tsx layout + wiring) |
| **Styles** | | | | |
| 37 | `src/index.css` (CSS variables) | `frontend/src/index.css` (append) | Merge | Add theme CSS variables |
| 38 | `src/App.css` | Drop | — | Not needed; uses Tailwind + CSS vars |

### Files NOT ported

| File | Reason |
|---|---|
| `src/context/ThemeContext.tsx` | Target app uses its own dark theme via Tailwind `dark:` classes, not CSS variables. The visual builder's theme system should be adapted to match the target app's design. |
| `vite.config.ts` | Build config is already in `vite.config.js` |
| `tailwind.config.js` | Already exists at target, may need minor extensions |
| `postcss.config.js` | Already exists at target |
| `tsconfig.json` | Not needed — target app uses JSX |
| `index.html` | Target already has one |

---

## 6. Phase 1: Core Structure Setup

### Step 1.1 — Create new files/directories

```bash
mkdir frontend/src/components/terraform
mkdir frontend/src/data
```

### Step 1.2 — Add new npm dependencies

In `frontend/package.json`, add:
```json
"dependencies": {
  "react-resizable-panels": "^4.11.0",
  "pdfjs-dist": "^5.4.624",
  "tesseract.js": "^7.0.0"
}
```

Then:
```bash
cd frontend
npm install
```

### Step 1.3 — Increase chunk size warning limit

In `frontend/vite.config.js`, the current chunk size warning is 600KB — the Terraform builder adds ~1MB+ due to Monaco + ReactFlow + data files. Update:

```js
build: {
  chunkSizeWarningLimit: 1200,
}
```

### Step 1.4 — Create the page route

In `frontend/src/App.jsx`:
- Add import: `import TerraformBuilderPage from './pages/TerraformBuilderPage'`
- Add route: `<Route path="/terraform-builder" element={<TerraformBuilderPage />} />`

### Step 1.5 — Add sidebar link

In `frontend/src/components/Sidebar.jsx`:
- Add to `PRIMARY_TOOLS` or `Infrastructure` group:
```js
{ path: '/terraform-builder', label: 'Terraform Builder', icon: '🏗️', description: 'Visual Infrastructure Designer' }
```

---

## 7. Phase 2: Data Layer Port

### Step 2.1 — Port type definitions

`types/resources.ts` → `data/terraformResources.js`

Convert TypeScript interfaces to JSDoc-annotated JavaScript objects:

```js
/**
 * @typedef {'aws_instance'|'aws_s3_bucket'|'aws_vpc'|...} ResourceType
 */

/**
 * @typedef {Object} ResourceField
 * @property {string} key
 * @property {string} label
 * @property {'text'|'select'|'number'|'boolean'|'textarea'} type
 * @property {string|number|boolean} [default]
 * @property {string[]} [options]
 * @property {boolean} [required]
 * @property {string} [placeholder]
 */

/**
 * @typedef {Object} ResourcePort
 * @property {string} id
 * @property {string} label
 * @property {'left'|'right'} side
 * @property {'target'|'source'} type
 * @property {string} color
 * @property {ResourceType[]} [accepts]
 */

/**
 * @typedef {Object} ResourceDefinition
 * @property {ResourceType} type
 * @property {string} label
 * @property {string} icon
 * @property {string} color
 * @property {string} bgColor
 * @property {string} borderColor
 * @property {string} category
 * @property {ResourceField[]} fields
 * @property {string} description
 * @property {ResourcePort[]} ports
 */

/**
 * @typedef {Object} ResourceNodeData
 * @property {ResourceType} resourceType
 * @property {string} resourceName
 * @property {Object.<string, string|number|boolean>} config
 * @property {ResourceDefinition} definition
 */
```

**Key changes from TypeScript:**
- `interface` → JSDoc `@typedef`
- `ResourceType` union → JSDoc typedef with all string literals
- `as any` casts → remove (JS doesn't need them)
- All `readonly` → remove

### Step 2.2 — Port resource definitions

`resourceDefinitions.ts` (1830 lines) → `data/resourceDefinitions.js`

**Changes:**
- Remove `import { ResourceDefinition } from '../types/resources'`
- Remove `as ResourceDefinition[]` casts from other files (azure, gcp, etc.)
- Remove `as any` type assertions
- Export arrays directly: `export const RESOURCE_DEFINITIONS = [...]`
- Keep `export const CATEGORIES` array

### Step 2.3 — Port dependency data

`dependencies.ts` → `data/terraformDependencies.js`

**Changes:**
- Remove TypeScript imports
- Remove `MarkerType` import (use string literal `'arrowclosed'` instead)
- Convert interface to JSDoc:

```js
/**
 * @typedef {Object} Dependency
 * @property {ResourceType} resourceType
 * @property {string} label
 * @property {string} icon
 * @property {string} reason
 * @property {boolean} required
 * @property {string} sourcePortId
 * @property {string} targetPortId
 * @property {string} portColor
 * @property {Object.<string, string|number|boolean>} [defaultConfig]
 */

/**
 * @typedef {Object} ResourceDependencies
 * @property {ResourceType} resourceType
 * @property {Dependency[]} deps
 */
```

### Step 2.4 — Port blueprints & templates

`blueprints.ts` → `data/terraformBlueprints.js`

**Changes:**
- Remove type annotations
- Remove `as Blueprint` casts
- Export as plain JS arrays

`architectureTemplates.ts` → `data/architectureTemplates.js`

**Changes:** Same pattern — remove types, export as JS arrays.

---

## 8. Phase 3: Store Port

### Step 3.1 — Create Zustand store

`store/useStore.ts` → `store/useTerraformStore.js`

**Follow the existing `useDockerIntelligenceStore.js` pattern** (Zustand v5 with optional persistence):

```js
import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow'

const useTerraformStore = create((set) => ({
  // State
  nodes: [],
  edges: [],
  selectedNodeId: null,
  providerRegion: 'us-east-1',
  providerProfile: 'default',
  cloudProvider: 'aws',  // 'aws' | 'azure' | 'gcp' | 'ansible' | 'crossplane'

  // Actions
  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) =>
    set((state) => ({ edges: addEdge(connection, state.edges) })),

  addNode: (node) =>
    set((state) => ({ nodes: [...state.nodes, node] })),

  addBlueprint: (newNodes, newEdges) =>
    set((state) => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges],
    })),

  updateNodeConfig: (nodeId, config) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } }
          : n
      ),
    })),

  updateNodeName: (nodeId, name) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, resourceName: name } } : n
      ),
    })),

  deleteNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    })),

  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setProviderRegion: (region) => set({ providerRegion: region }),
  setProviderProfile: (profile) => set({ providerProfile: profile }),

  setCloudProvider: (provider) =>
    set({ cloudProvider: provider, nodes: [], edges: [], selectedNodeId: null }),

  clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}))

export default useTerraformStore
```

**Changes from TypeScript version:**
- Remove generic type parameter `AppState`
- Remove `Node<ResourceNodeData>` type annotations
- Remove `ResourceNodeData['config']` partial type
- Remove `NodeChange`, `EdgeChange`, `Connection` type imports
- Use default export (target app convention)

---

## 9. Phase 4: Utility Port

### Step 4.1 — Code generators

All generators (`terraformGenerator.ts`, `azureGenerator.ts`, `gcpGenerator.ts`, `ansibleGenerator.ts`, `crossplaneGenerator.ts`) follow the same pattern:

**Signature pattern:**
```ts
// TypeScript original
export function generateTerraform(
  nodes: Node<ResourceNodeData>[],
  region: string,
  profile: string,
  includeCosts?: boolean
): string
```

**JavaScript conversion:**
```js
// No type annotations — use JSDoc for clarity
/**
 * @param {Array} nodes
 * @param {string} region
 * @param {string} profile
 * @param {boolean} [includeCosts]
 * @returns {string}
 */
export function generateTerraform(nodes, region, profile, includeCosts = false) {
  // ... same logic
}
```

**Key changes:**
- Remove `import { Node } from 'reactflow'` and `import { ResourceNodeData } from '../types/resources'`
- Remove all `: Type` annotations from function params and return types
- Remove `as const` assertions
- Remove `import { estimateCosts } from './costEstimator'` → use `import` (ESM, same)

### Step 4.2 — Cost estimator

`costEstimator.ts` → `utils/costEstimator.js`

**Changes:**
- Remove interface definitions → JSDoc
- Remove `Node`, `ResourceNodeData`, `ResourceType` imports
- Remove `: CostSummary` / `: CostItem` return type annotations

### Step 4.3 — Security audit

`securityAudit.ts` → `utils/securityAudit.js`

**Changes:**
- Remove `AuditFinding`, `AuditResult` interfaces → JSDoc
- Remove severity type → JSDoc @typedef
- Same pattern for removing type annotations

### Step 4.4 — Diagram scanner & parser

`diagramScanner.ts` → `utils/diagramScanner.js`
`diagramParser.ts` → `utils/diagramParser.js`

**Changes:**
- Remove all TypeScript imports and type annotations
- Keep logic identical

### Step 4.5 — Multi-file export

`multiFileExport.ts` → `utils/multiFileExport.js`
`envGenerator.ts` → `utils/envGenerator.js`

**Changes:**
- Remove type annotations for `TerraformProject` and `EnvTerraformProject` objects
- Keep all logic (JSZip dynamic import, Blob creation, download) unchanged

---

## 10. Phase 5: Component Port

### Step 5.1 — Canvas component

`Canvas.tsx` → `components/terraform/Canvas.jsx`

**Key conversion notes:**
- `React.FC<CanvasProps>` → plain function component with JSDoc @param
- `React.DragEvent` → remove type annotation
- `ReactFlowInstance` → remove
- `BackgroundVariant` → use string `'dots'` directly
- `MarkerType.ArrowClosed` → use string `'arrowclosed'` (ReactFlow accepts strings)

```jsx
import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, BackgroundVariant,
  ConnectionLineType, MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Zap } from 'lucide-react';
import useTerraformStore from '../../store/useTerraformStore';
import ResourceNode from './ResourceNode';
```

### Step 5.2 — ResourceNode component

`ResourceNode.tsx` → `components/terraform/ResourceNode.jsx`

**Key changes:**
- `NodeProps<ResourceNodeData>` → destructure props directly (JS convention)
- `memo(ResourceNode)` → keep (React.memo works the same in JS)
- Remove type annotations from `data`, `id`, `selected`
- `Position.Left` / `Position.Right` → use string `'left'` / `'right'`

```jsx
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Trash2 } from 'lucide-react';
import useTerraformStore from '../../store/useTerraformStore';

function ResourceNode({ data, id, selected }) {
  // data.definition, data.resourceName — no type annotations needed
  // ...
}

export default memo(ResourceNode);
```

### Step 5.3 — ConfigPanel

`ConfigPanel.tsx` → `components/terraform/ConfigPanel.jsx`

**Key changes:**
- Remove `ResourceNodeData` import
- `selectedNode.data` — access as plain JS objects
- All type annotations on event handlers → remove

### Step 5.4 — CodePanel

`CodePanel.tsx` → `components/terraform/CodePanel.jsx`

**Key changes:**
- Remove type annotations from all state variables and functions
- Dynamic imports (`import('jszip')`) → keep as-is (works in JS)
- Monaco editor configuration → keep unchanged

### Step 5.5 — Header renamed to Toolbar

`Header.tsx` → `components/terraform/Toolbar.jsx`

**Key changes:**
- `HeaderProps` → JSDoc
- Remove theme context import (target app handles theme differently)
- Adapt region/profile controls to target app's design system
- Remove theme toggle button (use existing app theme)

### Step 5.6 — Sidebar renamed to ResourcePalette

`Sidebar.tsx` → `components/terraform/ResourcePalette.jsx`

**Key changes:**
- This is the largest component (554 lines). Port carefully.
- Tool mode selector (Terraform/Ansible/Crossplane) — keep
- Cloud provider selector (AWS/Azure/GCP) — keep
- Search and category filter — keep
- Resource cards with drag — keep
- Convert `React.ReactNode` to plain JSX
- Remove `CloudProvider` type import

### Step 5.7 — Other components

**CostPanel, SecurityPanel, DiffPanel, SuggestionPanel, BlueprintModal, TemplatesModal, DiagramScanModal:**

All follow the same TS→JS conversion pattern:
- Remove type imports
- Remove `: Type` annotations from props, state, and functions
- Remove `React.FC<Props>` → plain function component
- Convert `React.DragEvent`, `React.MouseEvent` → remove annotations
- Keep all JSX and logic unchanged

### Step 5.8 — SuggestionPanel

`SuggestionPanel.tsx` → `components/terraform/SuggestionPanel.jsx` (420 lines)

**This is the most complex component.** It handles:
- Finding missing dependencies for selected resource
- Showing create-new vs connect-existing UI
- Batch-adding all required dependencies

**Key changes:**
- Remove `Node<ResourceNodeData>` type import
- Remove `Dependency | MultiCloudDependency` union type
- `AnyDep` → plain object access in JS (duck typing)
- Everything else stays the same

---

## 11. Phase 6: Integration & Wiring

### Step 6.1 — Create TerraformBuilderPage

This is the **new page** that replaces the visual builder's `App.tsx`. It follows the pattern of `DockerIntelligencePage.jsx` (complex multi-column layout).

```
┌───────────────────────────────────────────────────────────┐
│ Page Header (title, action buttons, resource count)       │
├──────────┬────────────────────────────────────┬───────────┤
│          │                                    │           │
│ Resource │     ReactFlow Canvas               │ Right     │
│ Palette  │     (drag-and-drop)                │ Panel     │
│ (w-72)   │     + empty state                  │ (tabbed:  │
│          │     + MiniMap, Controls            │ Config /  │
│ Tool     │                                    │ Code /    │
│ Mode     │                                    │ Cost /    │
│ Cloud    │                                    │ Security  │
│ Selector │                                    │ / Diff)   │
│          │                                    │           │
│ Search   │                                    │           │
│ & Filter │                                    │           │
│          │                                    │           │
│ Resource │                                    │           │
│ Cards    │                                    │           │
├──────────┴────────────────────────────────────┴───────────┤
│ BlueprintModal / TemplatesModal / DiagramScanModal        │
└───────────────────────────────────────────────────────────┘
```

**Layout code structure:**

```jsx
import React, { useState, useCallback, useRef } from 'react'
import { ReactFlowInstance } from 'reactflow'
// Store
import useTerraformStore from '../store/useTerraformStore'
// Data
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions'
import { AZURE_DEFINITIONS } from '../data/azureDefinitions'
import { GCP_DEFINITIONS } from '../data/gcpDefinitions'
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions'
import { CROSSPLANE_DEFINITIONS, CROSSPLANE_AWS_DEFINITIONS, CROSSPLANE_AZURE_DEFINITIONS, CROSSPLANE_GCP_DEFINITIONS } from '../data/crossplaneDefinitions'
// Components
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

let idCounter = { current: 1 }

export default function TerraformBuilderPage() {
  const { addNode, selectedNodeId, cloudProvider } = useTerraformStore()
  const [draggedDefinition, setDraggedDefinition] = useState(null)
  const [showBlueprints, setShowBlueprints] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showDiagramScan, setShowDiagramScan] = useState(false)
  const [rightPanel, setRightPanel] = useState('code') // 'code' | 'cost' | 'security' | 'diff'
  const blueprintOffset = useRef(1000)

  const handleDragStart = useCallback((e, definition) => {
    e.dataTransfer.setData('application/resourceLabel', definition.label)
    e.dataTransfer.setData('application/resourceType', definition.type)
    e.dataTransfer.effectAllowed = 'copy'
    setDraggedDefinition(definition)
  }, [])

  const handleDrop = useCallback((e, rfInstance) => {
    const label = e.dataTransfer.getData('application/resourceLabel')
    const type = e.dataTransfer.getData('application/resourceType')
    if (!label && !type) return

    const providerDefs = ALL_DEFINITIONS[cloudProvider] ?? RESOURCE_DEFINITIONS
    const definition = providerDefs.find((d) => d.label === label)
      ?? providerDefs.find((d) => d.type === type)

    if (!definition) return

    const position = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const id = `node_${idCounter.current++}`

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
        resourceName: `${cleanName}_${idCounter.current - 1}`,
        config: defaultConfig,
        definition,
      },
    })

    setDraggedDefinition(null)
  }, [addNode, cloudProvider])

  // ... render with full layout
}
```

### Step 6.2 — Wire up App.jsx

```jsx
// Add import
import TerraformBuilderPage from './pages/TerraformBuilderPage'

// Add route inside <Routes>
<Route path="/terraform-builder" element={<TerraformBuilderPage />} />
```

### Step 6.3 — Wire up Sidebar.jsx

Add to `PRIMARY_TOOLS` array:
```js
{ path: '/terraform-builder', label: 'Terraform Builder', icon: '🏗️', description: 'Visual Infrastructure Designer' },
```

---

## 12. Phase 7: Backend Enhancement

### Step 7.1 — Create terraform route

`backend/routes/terraform.py` — create new file:

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any

router = APIRouter(prefix="/terraform", tags=["terraform"])

class ResourceNode(BaseModel):
    id: str
    resourceType: str
    resourceName: str
    config: dict[str, Any]
    provider: str  # aws | azure | gcp

class TerraformRequest(BaseModel):
    nodes: list[ResourceNode]
    region: str = "us-east-1"
    profile: str = "default"
    provider: str = "aws"

class TerraformResponse(BaseModel):
    status: str
    data: dict

@router.post("/generate", response_model=TerraformResponse)
async def generate_terraform(req: TerraformRequest):
    """Accept graph payload and return generated HCL.
    
    For now this delegates to the frontend generators.
    Future: subprocess terraform fmt for validation.
    """
    # The visual builder generates HCL entirely client-side.
    # This backend endpoint exists for:
    # 1. Future server-side generation with terraform fmt
    # 2. AI-assisted generation using LLM
    # 3. Validation against provider schemas
    return {
        "status": "success",
        "data": {
            "message": "Generation happens client-side in the visual builder",
            "node_count": len(req.nodes),
            "provider": req.provider,
            "region": req.region,
        }
    }

@router.post("/validate")
async def validate_terraform(hcl_content: str):
    """Validate HCL syntax (future: use tflint or terraform fmt)."""
    # Future implementation
    return {"status": "success", "data": {"valid": True}}
```

### Step 7.2 — Register route in main.py

```python
from routes import terraform

app.include_router(terraform.router)
```

---

## 13. Phase 8: AI Integration

### Step 13.1 — AI-assisted architecture design

The target app already has `AISettingsContext` and `useAIStream.js`. Connect these to the visual builder:

**New feature: "Describe your architecture"**

```jsx
// In TerraformBuilderPage.jsx
import { useAIStream } from '../hooks/useAIStream'
import { useAISettings } from '../context/AISettingsContext'

// Example AI prompt:
const prompt = `Generate a Terraform architecture for: "${userDescription}".
Return a JSON array of resource objects with type, name, and configuration.`

// AI response → parse → create nodes on canvas
```

### Step 13.2 — AI dependency suggestions

The visual builder already has rule-based dependency suggestions (`SuggestionPanel.tsx`). Enhance with AI:

- When user adds a resource, the AI can suggest **additional** dependencies not in the static map
- AI can suggest optimal instance types, AMIs, and configuration values

### Step 13.3 — AI code review

Use existing `useAIRequest.js` to add a "Review with AI" button in the CodePanel that:
- Sends the generated HCL to the AI provider
- Returns optimization suggestions, security issues, and best-practice recommendations

---

## 14. TypeScript → JavaScript Conversion Guide

### 14.1 Import changes

```ts
// TypeScript
import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';
import type { ResourceDefinition } from '../types/resources';
import { FC, useCallback } from 'react';
```

```js
// JavaScript
import { useCallback } from 'react';
// Node/ResourceNodeData — not imported, props are plain objects
// ResourceDefinition — not imported, use JSDoc if needed
```

### 14.2 Function signature conversion

```ts
// TypeScript
export function generateTerraform(
  nodes: Node<ResourceNodeData>[],
  region: string,
  profile: string,
  includeCosts?: boolean
): string {
```

```js
// JavaScript
/**
 * @param {Array} nodes - ReactFlow nodes with ResourceNodeData
 * @param {string} region - AWS/Azure/GCP region
 * @param {string} profile - AWS profile / GCP project / Azure subscription
 * @param {boolean} [includeCosts] - Include cost estimation in output
 * @returns {string} Generated HCL code
 */
export function generateTerraform(nodes, region, profile, includeCosts = false) {
```

### 14.3 Interface → JSDoc conversion

```ts
// TypeScript
export interface CostItem {
  resourceType: ResourceType;
  resourceName: string;
  label: string;
  icon: string;
  monthlyMin: number;
  monthlyMax: number;
  basis: string;
}
```

```js
// JavaScript
/**
 * @typedef {Object} CostItem
 * @property {string} resourceType
 * @property {string} resourceName
 * @property {string} label
 * @property {string} icon
 * @property {number} monthlyMin
 * @property {number} monthlyMax
 * @property {string} basis
 */
```

### 14.4 Component conversion

```tsx
// TypeScript
interface CanvasProps {
  draggedDefinition: ResourceDefinition | null;
  onDrop: (e: React.DragEvent, rfInstance: ReactFlowInstance) => void;
  onOpenBlueprints?: () => void;
}

export default function Canvas({ onDrop, onOpenBlueprints }: CanvasProps) {
```

```jsx
// JavaScript
/**
 * @param {Object} props
 * @param {Function} props.onDrop
 * @param {Function} [props.onOpenBlueprints]
 */
export default function Canvas({ onDrop, onOpenBlueprints }) {
```

### 14.5 Event handler conversion

```tsx
// TypeScript
const handleDragStart = useCallback((e: React.DragEvent, definition: ResourceDefinition) => {
```

```jsx
// JavaScript
const handleDragStart = useCallback((e, definition) => {
```

### 14.6 Type assertion removal

```ts
// TypeScript
const AZURE_DEFINITIONS = definitions as ResourceDefinition[];
const item = items.find(i => i.type === type) as CostItem;

// as any — remove entirely
```

```js
// JavaScript
const AZURE_DEFINITIONS = definitions;  // Plain array
const item = items.find(i => i.type === type);  // Duck-typing
```

### 14.7 Generic type removal

```ts
// TypeScript
const [confirmSwitch, setConfirmSwitch] = useState<{ mode: ToolMode; cloud?: TerraformCloud | CrossplaneCloud } | null>(null);

const activeDefs = new Map<string, Node<ResourceNodeData>>();
```

```js
// JavaScript
const [confirmSwitch, setConfirmSwitch] = useState(null);

const activeDefs = new Map();
```

### 14.8 React.FC removal

```ts
// TypeScript
const Canvas: React.FC<CanvasProps> = ({ onDrop }) => { ... }
```

```js
// JavaScript
export default function Canvas({ onDrop }) { ... }
```

---

## 15. Style & Theme Integration

### 15.1 CSS Variables

The visual builder's `index.css` defines theme CSS variables. These need to be adapted to the target app's existing theme system.

**Source CSS variables to port:**
```css
/* From visual-builder/src/index.css — adapt to target app's index.css */
:root {
  --bg-app: #0a0f1a;
  --bg-surface: #0f172a;
  --bg-sidebar: rgba(15, 23, 42, 0.95);
  --bg-header: rgba(15, 23, 42, 0.85);
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-faint: #475569;
  --border: rgba(255, 255, 255, 0.08);
  --border-subtle: rgba(255, 255, 255, 0.05);
  --accent: #6366f1;
  --accent-light: #818cf8;
}
```

**Recommendation:** The target app already uses `bg-gray-950`, `bg-gray-900`, `border-gray-800/60`, etc. throughout. Map the visual builder's CSS variable usage to Tailwind classes instead:

| CSS Variable | Tailwind Equivalent |
|---|---|
| `var(--bg-app)` | `bg-gray-950` or `bg-[#0a0f1a]` |
| `var(--bg-surface)` | `bg-gray-900` |
| `var(--bg-header)` | `bg-gray-900/60 backdrop-blur-xl` |
| `var(--border)` | `border-gray-800/40` |
| `var(--accent)` | `text-indigo-500` |

### 15.2 Theme toggle

The visual builder has its own `ThemeContext.tsx` for dark/light mode. **Do not port this.** The target app uses a single dark theme (no light mode toggle). The visual builder will render in the same dark theme as the rest of the app.

### 15.3 Tailwind config extensions

The target's `tailwind.config.js` may need a few additions from the visual builder:

```js
// Add these to tailwind.config.js if not present:
colors: {
  gray: {
    950: '#0a0f1a',
  },
},
```

Most custom classes (`.glass`, `.gradient-border`, `.btn-primary`) already exist in the target's `index.css` and are compatible.

---

## 16. Testing & Verification

### 16.1 Post-integration checks

After completing each phase, verify:

| Check | Command/Test | Expected |
|---|---|---|
| Build succeeds | `npm run build` | No errors |
| No missing imports | Build output | All imports resolve |
| Route works | Navigate to `/terraform-builder` | Page renders |
| Canvas renders | Navigate + check console | No ReactFlow errors |
| Drag resource | Drag from palette | Node appears on canvas |
| Connect nodes | Draw edge between nodes | Edge renders with color |
| Code generation | Add resources | Code panel shows HCL |
| ZIP download | Click ZIP button | Browser downloads .zip |
| Monaco renders | Code panel | Editor renders with syntax highlighting |
| Cost estimation | Add resources with costs | Cost panel shows estimates |
| Blueprints | Click Quick Setup | Blueprint modal opens |
| Templates | Click Templates | Templates modal opens |

### 16.2 Component-level tests

The visual builder has no existing tests. After porting, consider adding:

- `__tests__/terraform/TerraformStore.test.js` — Zustand store actions
- `__tests__/terraform/terraformGenerator.test.js` — HCL output for known inputs
- `__tests__/terraform/costEstimator.test.js` — Cost calculations

### 16.3 Vite chunk size

Monitor the bundle size. The Terraform builder adds significant weight:
- `resourceDefinitions.js` — ~60KB (compressed)
- `terraformGenerator.js` — ~30KB
- Monaco Editor — already a dependency
- ReactFlow — already a dependency

The current `chunkSizeWarningLimit: 600` should be increased to `1200`.

---

## 17. Future Enhancements

### Post-integration roadmap:

| Priority | Feature | Description |
|---|---|---|
| P1 | **Terraform Plan Visualizer** | Parse `terraform plan` output → visualize resource changes (add/destroy/modify) on canvas with color coding |
| P1 | **AI Architecture Generator** | Use target app's existing AI streaming to convert natural language → visual architecture |
| P2 | **State File Viewer** | Upload `terraform.tfstate` → visualize resources and their current status |
| P2 | **Backend Validation** | Use `terraform fmt` subprocess in backend to validate generated HCL |
| P2 | **Provider Module Registry** | Browse and import modules from Terraform Registry |
| P3 | **Resource Import** | Import existing infrastructure from AWS/Azure/GCP into the canvas |
| P3 | **Cost History** | Track cost estimates over time with the existing Infracost integration |
| P3 | **Collaboration** | Share canvas state via URL, export as image |

---

## 18. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         devops-command-center                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  frontend/ (React 18 + Vite + Tailwind + JSX)               │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │  App.jsx (BrowserRouter)                             │   │   │
│  │  │  ├── MainLayout                                      │   │   │
│  │  │  │   ├── Sidebar.jsx (add "Terraform Builder" link)  │   │   │
│  │  │  │   ├── Top Bar                                     │   │   │
│  │  │  │   └── <Routes>                                    │   │   │
│  │  │  │       └── /terraform-builder ──┐                  │   │   │
│  │  │  └────────────────────────────────┼──────────────────┘   │   │
│  │  │                                   │                       │   │
│  │  │  ┌────────────────────────────────▼──────────────────┐   │   │
│  │  │  │  TerraformBuilderPage.jsx                         │   │   │
│  │  │  │                                                    │   │   │
│  │  │  │  ┌──────────┬──────────────────┬──────────────┐   │   │   │
│  │  │  │  │Resource  │  Canvas (RF)      │ Right Panel │   │   │   │
│  │  │  │  │Palette   │  ResourceNode     │ ConfigPanel │   │   │   │
│  │  │  │  │ +Search  │  (custom node)    │ CodePanel   │   │   │   │
│  │  │  │  │ +Filter  │  Edges with       │ CostPanel   │   │   │   │
│  │  │  │  │          │  port colors      │ Security    │   │   │   │
│  │  │  │  │          │  MiniMap          │ DiffPanel   │   │   │   │
│  │  │  │  │          │  Controls         │             │   │   │   │
│  │  │  │  └──────────┴──────────────────┴──────────────┘   │   │   │
│  │  │  │  + BlueprintModal / TemplatesModal / DiagramModal │   │   │
│  │  │  └────────────────────────────────────────────────────┘   │   │
│  │  │                                                          │   │
│  │  │  store/                          data/                   │   │
│  │  │  └── useTerraformStore.js        ├── resourceDefinitions │   │
│  │  │                                   ├── azureDefinitions   │   │
│  │  │  utils/                           ├── gcpDefinitions     │   │
│  │  │  ├── terraformGenerator.js        ├── ansibleDefinitions │   │
│  │  │  ├── azureGenerator.js            ├── crossplaneDefs     │   │
│  │  │  ├── gcpGenerator.js              ├── terraformDeps      │   │
│  │  │  ├── costEstimator.js             ├── terraformBlueprints│   │
│  │  │  ├── securityAudit.js             └── architectureTemplates│ │
│  │  │  ├── diagramScanner.js                                   │   │
│  │  │  ├── multiFileExport.js                                  │   │
│  │  │  └── envGenerator.js                                     │   │
│  │  └──────────────────────────────────────────────────────────┘   │
│  │                                                                  │
│  └──────────────────────────────────────────────────────────────────┘
│                           │
│                           │ /api/* (nginx proxy)
│                           ▼
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  backend/ (FastAPI + Python)                                 │   │
│  │  ├── main.py (register terraform router)                     │   │
│  │  ├── routes/terraform.py (NEW)                               │   │
│  │  │   └── POST /terraform/generate                            │   │
│  │  │   └── POST /terraform/validate                            │   │
│  │  └── services/ (future: server-side HCL gen, fmt, lint)     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: File Size Estimates

| Category | # Files | Est. Lines of Code | Complexity |
|---|---|---|---|
| Data layer | 10 | ~3,500 | Low (data only) |
| Store | 1 | ~100 | Low |
| Utils | 10 | ~2,500 | Medium (logic-heavy) |
| Components | 14 | ~3,500 | Medium-High (JSX + state) |
| Page | 1 | ~200 | Medium |
| Backend | 1 | ~50 | Low |
| **Total** | **37** | **~9,850** | |

## Appendix B: Estimated Integration Timeline

| Phase | Days | Tasks |
|---|---|---|
| Phase 1: Core Setup | 0.5 | Dirs, deps, route, sidebar link |
| Phase 2: Data Layer | 1.0 | Port 10 data files (TS→JS) |
| Phase 3: Store | 0.5 | Create Zustand store |
| Phase 4: Utils | 1.5 | Port 10 utility files (generators, cost, security) |
| Phase 5: Components | 3.0 | Port all 14 components |
| Phase 6: Integration | 1.0 | Wire up TerraformBuilderPage, test |
| Phase 7: Backend | 0.5 | Create terraform route |
| Phase 8: AI Integration | 1.0 | Connect AI hooks for arch generation |
| Testing & Polish | 1.0 | Fix issues, verify all features |
| **Total** | **~10 days** | |

## Appendix C: Directory Structure After Integration

```
frontend/src/
├── App.jsx                           # + Route for /terraform-builder
├── components/
│   ├── Sidebar.jsx                   # + Link to Terraform Builder
│   └── terraform/                    # NEW — all visual builder components
│       ├── Canvas.jsx
│       ├── ResourceNode.jsx
│       ├── ConfigPanel.jsx
│       ├── CodePanel.jsx
│       ├── CostPanel.jsx
│       ├── SecurityPanel.jsx
│       ├── DiffPanel.jsx
│       ├── SuggestionPanel.jsx
│       ├── BlueprintModal.jsx
│       ├── TemplatesModal.jsx
│       ├── DiagramScanModal.jsx
│       ├── Toolbar.jsx
│       └── ResourcePalette.jsx
├── pages/
│   ├── TerraformBuilderPage.jsx     # NEW — full visual builder page
│   └── ... (existing pages)
├── store/
│   ├── useTerraformStore.js         # NEW — visual builder state
│   └── ... (existing stores)
├── data/                             # NEW — resource definitions & configs
│   ├── terraformResources.js         # Type definitions (JSDoc)
│   ├── resourceDefinitions.js
│   ├── azureDefinitions.js
│   ├── gcpDefinitions.js
│   ├── ansibleDefinitions.js
│   ├── crossplaneDefinitions.js
│   ├── terraformDependencies.js
│   ├── multiCloudDependencies.js
│   ├── terraformBlueprints.js
│   └── architectureTemplates.js
└── utils/                            # NEW — generation & analysis engines
    ├── terraformGenerator.js
    ├── azureGenerator.js
    ├── gcpGenerator.js
    ├── ansibleGenerator.js
    ├── crossplaneGenerator.js
    ├── costEstimator.js
    ├── securityAudit.js
    ├── diagramScanner.js
    ├── diagramParser.js
    ├── multiFileExport.js
    └── envGenerator.js
```
