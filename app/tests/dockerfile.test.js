import { describe, it, expect } from 'vitest'
import { LAYERS, DOCKERFILE_TEXT, layersByStage, RUNTIME_LAYERS } from '../src/dockerfile.js'

describe('dockerfile data', () => {
  it('has 10 ordered layers, build stage then runtime stage', () => {
    expect(LAYERS).toHaveLength(10)
    expect(LAYERS.map(l => l.instruction)).toEqual([
      'FROM', 'WORKDIR', 'COPY', 'RUN', 'COPY', 'RUN',
      'FROM', 'COPY', 'EXPOSE', 'CMD',
    ])
    const stages = LAYERS.map(l => l.stage)
    expect(stages.slice(0, 6).every(s => s === 'build')).toBe(true)
    expect(stages.slice(6).every(s => s === 'runtime')).toBe(true)
  })

  it('every layer has unique id and required fields', () => {
    const ids = new Set(LAYERS.map(l => l.id))
    expect(ids.size).toBe(LAYERS.length)
    for (const l of LAYERS) {
      expect(l.note.length).toBeGreaterThan(0)
      expect(typeof l.sizeLabel).toBe('string')
      expect(l.icon.startsWith('mdi')).toBe(true)
    }
  })

  it('assembled text contains both FROM lines and the multi-stage COPY', () => {
    expect(DOCKERFILE_TEXT).toContain('FROM node:20-alpine AS build')
    expect(DOCKERFILE_TEXT).toContain('FROM nginx:alpine')
    expect(DOCKERFILE_TEXT).toContain('COPY --from=build /app/dist /usr/share/nginx/html')
    expect(DOCKERFILE_TEXT).toContain('CMD ["nginx","-g","daemon off;"]')
  })

  it('helpers filter by stage', () => {
    expect(layersByStage('build')).toHaveLength(6)
    expect(RUNTIME_LAYERS).toHaveLength(4)
  })
})
