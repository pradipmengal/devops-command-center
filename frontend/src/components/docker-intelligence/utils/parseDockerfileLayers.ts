/**
 * parseDockerfileLayers — pure function that parses a Dockerfile string into
 * an array of LayerNode objects, one per non-comment, non-empty instruction line.
 *
 * LayerNode shape:
 *   { id, instruction, args, estimatedSize, cacheStatus, sizeCategory }
 *
 * sizeCategory: 'small' (<10MB), 'medium' (10–100MB), 'large' (>100MB)
 *
 * This function is deterministic and has no side effects — safe to use in
 * useMemo and unit/property tests.
 */

// Instructions that typically create large layers
const LARGE_LAYER_INSTRUCTIONS = new Set(['FROM', 'RUN', 'COPY', 'ADD'])

// Heuristic size estimates (MB) per instruction type
const SIZE_HEURISTICS = {
  FROM: (args) => {
    const lower = args.toLowerCase()
    if (lower.includes('scratch')) return 0
    if (lower.includes('alpine')) return 8
    if (lower.includes('slim')) return 30
    if (lower.includes('distroless')) return 20
    if (lower.includes('ubuntu') || lower.includes('debian')) return 120
    if (lower.includes('node')) return 180
    if (lower.includes('python')) return 150
    if (lower.includes('golang')) return 300
    if (lower.includes('java') || lower.includes('openjdk')) return 400
    return 50 // generic base image
  },
  RUN: (args) => {
    const lower = args.toLowerCase()
    // Package installs are large
    if (lower.includes('apt-get install') || lower.includes('apt install')) return 80
    if (lower.includes('apk add')) return 20
    if (lower.includes('yum install') || lower.includes('dnf install')) return 100
    if (lower.includes('pip install') || lower.includes('pip3 install')) return 60
    if (lower.includes('npm install') || lower.includes('npm ci')) return 150
    if (lower.includes('yarn install') || lower.includes('yarn add')) return 150
    if (lower.includes('go build') || lower.includes('go get')) return 50
    if (lower.includes('cargo build')) return 200
    if (lower.includes('make') || lower.includes('cmake')) return 30
    // Cleanup commands are small
    if (lower.includes('rm -rf') || lower.includes('apt-get clean')) return 0
    return 5 // generic RUN
  },
  COPY: (args) => {
    // Heuristic: copying source code is medium, single files are small
    if (args.includes('.') || args.includes('src') || args.includes('app')) return 15
    return 2
  },
  ADD: (args) => {
    // ADD can unpack archives — potentially large
    if (args.match(/\.(tar|gz|zip|tgz)/i)) return 50
    return 10
  },
  WORKDIR: () => 0,
  ENV: () => 0,
  ARG: () => 0,
  EXPOSE: () => 0,
  LABEL: () => 0,
  USER: () => 0,
  VOLUME: () => 0,
  ENTRYPOINT: () => 0,
  CMD: () => 0,
  HEALTHCHECK: () => 0,
  SHELL: () => 0,
  STOPSIGNAL: () => 0,
  ONBUILD: () => 0,
  MAINTAINER: () => 0,
}

/**
 * Determine the size category from an estimated size in MB.
 * @param {number} sizeMB
 * @returns {'small'|'medium'|'large'}
 */
export function getSizeCategory(sizeMB) {
  if (sizeMB < 10) return 'small'
  if (sizeMB <= 100) return 'medium'
  return 'large'
}

/**
 * Determine if a layer is likely cache-friendly.
 * Cache-busting instructions: RUN with package installs, COPY of source code.
 * Cache-friendly: ENV, ARG, LABEL, EXPOSE, WORKDIR, USER, HEALTHCHECK.
 * @param {string} instruction
 * @param {string} args
 * @returns {'hit'|'miss'|'unknown'}
 */
function getCacheStatus(instruction, args) {
  const cacheFriendly = new Set(['ENV', 'ARG', 'LABEL', 'EXPOSE', 'WORKDIR', 'USER', 'HEALTHCHECK', 'SHELL'])
  if (cacheFriendly.has(instruction)) return 'hit'

  if (instruction === 'COPY' || instruction === 'ADD') {
    // Copying source code is cache-busting (changes frequently)
    return 'miss'
  }

  if (instruction === 'RUN') {
    const lower = args.toLowerCase()
    // Package installs with no pinned versions are cache-busting
    if (lower.includes('apt-get update') || lower.includes('apk update')) return 'miss'
    return 'unknown'
  }

  if (instruction === 'FROM') return 'hit'

  return 'unknown'
}

/**
 * Parse a Dockerfile string into an array of LayerNode objects.
 *
 * @param {string} content - Raw Dockerfile content
 * @returns {LayerNode[]}
 */
export function parseDockerfileLayers(content) {
  if (!content || typeof content !== 'string') return []

  const lines = content.split('\n')
  const nodes = []
  let nodeIndex = 0
  let continuationBuffer = ''

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    // Handle line continuations (backslash at end)
    if (trimmed.endsWith('\\')) {
      continuationBuffer += trimmed.slice(0, -1).trim() + ' '
      continue
    }

    // Complete the instruction (with any continuation)
    const fullLine = continuationBuffer + trimmed
    continuationBuffer = ''

    // Parse instruction and args
    const spaceIdx = fullLine.indexOf(' ')
    const instruction = spaceIdx === -1
      ? fullLine.toUpperCase()
      : fullLine.slice(0, spaceIdx).toUpperCase()
    const args = spaceIdx === -1 ? '' : fullLine.slice(spaceIdx + 1).trim()

    // Estimate size
    const sizeFn = SIZE_HEURISTICS[instruction] || (() => 1)
    const estimatedSizeMB = sizeFn(args)
    const sizeCategory = getSizeCategory(estimatedSizeMB)
    const cacheStatus = getCacheStatus(instruction, args)

    nodes.push({
      id: `layer-${nodeIndex}`,
      instruction,
      args,
      estimatedSize: estimatedSizeMB === 0 ? '~0MB' : `~${estimatedSizeMB}MB`,
      estimatedSizeMB,
      cacheStatus,
      sizeCategory,
    })

    nodeIndex++
  }

  return nodes
}

export default parseDockerfileLayers
