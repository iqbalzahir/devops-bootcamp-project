// Single source of truth for the taught multi-stage Dockerfile.
// icon values are @mdi/js export names, resolved in icons.js.
export const LAYERS = [
  { id: 'from-build', stage: 'build', instruction: 'FROM', args: 'node:20-alpine AS build',
    note: 'Every image starts FROM a base. Here: a small Node image, named "build".',
    sizeLabel: '~180 MB', icon: 'mdiLayersTriple' },
  { id: 'workdir', stage: 'build', instruction: 'WORKDIR', args: '/app',
    note: 'Sets the working directory for the commands that follow.',
    sizeLabel: '0 B', icon: 'mdiFolderOutline' },
  { id: 'copy-manifests', stage: 'build', instruction: 'COPY', args: 'package*.json ./',
    note: 'Copy manifests FIRST. If they do not change, Docker reuses the cached install layer.',
    sizeLabel: '4 KB', icon: 'mdiFileDocumentOutline' },
  { id: 'npm-ci', stage: 'build', instruction: 'RUN', args: 'npm ci',
    note: 'Installs dependencies into their own cached layer.',
    sizeLabel: '~120 MB', icon: 'mdiDownloadOutline' },
  { id: 'copy-src', stage: 'build', instruction: 'COPY', args: '. .',
    note: 'Now copy the rest of the source. Changes here do not bust the install cache above.',
    sizeLabel: '~1 MB', icon: 'mdiCodeTags' },
  { id: 'npm-build', stage: 'build', instruction: 'RUN', args: 'npm run build',
    note: 'Produces the static site in dist/.',
    sizeLabel: '~2 MB', icon: 'mdiCogOutline' },
  { id: 'from-runtime', stage: 'runtime', instruction: 'FROM', args: 'nginx:alpine',
    note: 'A fresh, tiny runtime stage. The whole build stage above is discarded.',
    sizeLabel: '~24 MB', icon: 'mdiLayersTriple' },
  { id: 'copy-from', stage: 'runtime', instruction: 'COPY', args: '--from=build /app/dist /usr/share/nginx/html',
    note: 'Only the built dist/ travels into the final image. No Node, no node_modules.',
    sizeLabel: '~2 MB', icon: 'mdiTransferRight' },
  { id: 'expose', stage: 'runtime', instruction: 'EXPOSE', args: '80',
    note: 'Documents the port the container listens on.',
    sizeLabel: '0 B', icon: 'mdiLanConnect' },
  { id: 'cmd', stage: 'runtime', instruction: 'CMD', args: '["nginx","-g","daemon off;"]',
    note: 'The command run when the container starts.',
    sizeLabel: '0 B', icon: 'mdiConsole' },
]

export function layersByStage(stage) {
  return LAYERS.filter((l) => l.stage === stage)
}

export const RUNTIME_LAYERS = layersByStage('runtime')

export const DOCKERFILE_TEXT = [
  '# --- build stage ---',
  ...layersByStage('build').map((l) => `${l.instruction} ${l.args}`),
  '',
  '# --- runtime stage ---',
  ...layersByStage('runtime').map((l) => `${l.instruction} ${l.args}`),
].join('\n')
