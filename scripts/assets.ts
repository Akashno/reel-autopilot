// Copies brand/assets/ into public/brand/, where the renderer serves files from.
// public/brand/ is generated: edit brand/assets/ instead.
import { cpSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

export function syncAssets() {
  const to = join(ROOT, 'public/brand')
  rmSync(to, { recursive: true, force: true })
  cpSync(join(ROOT, 'brand/assets'), to, { recursive: true })
}

if (import.meta.url === `file://${process.argv[1]}`)
  syncAssets()
