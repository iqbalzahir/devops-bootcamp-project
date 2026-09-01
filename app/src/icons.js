// Static named imports (not `import * as`) so the bundler tree-shakes @mdi/js
// down to just the icons we use, instead of shipping the whole ~2.8MB set.
import {
  mdiChevronDown,
  mdiCodeTags,
  mdiCogOutline,
  mdiConsole,
  mdiDownloadOutline,
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiLanConnect,
  mdiLayersTriple,
  mdiTransferRight,
  mdiVolumeHigh,
  mdiVolumeOff,
} from '@mdi/js'

const ICONS = {
  mdiChevronDown,
  mdiCodeTags,
  mdiCogOutline,
  mdiConsole,
  mdiDownloadOutline,
  mdiFileDocumentOutline,
  mdiFolderOutline,
  mdiLanConnect,
  mdiLayersTriple,
  mdiTransferRight,
  mdiVolumeHigh,
  mdiVolumeOff,
}

export function mdi(name, size = 18, color = '#7dd3fc') {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <path fill="${color}" d="${mdiPath(name)}"/></svg>`
}

// Raw 24x24 path data for a given icon name — for embedding directly into an
// existing SVG (e.g. the blueprint annotation chips) rather than a full <svg>.
export function mdiPath(name) {
  const path = ICONS[name]
  if (!path) throw new Error(`Unknown MDI icon: ${name}`)
  return path
}
