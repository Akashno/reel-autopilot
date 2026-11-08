// reel.schema.json is the scene library; this fills in the brand's own lists (avatars, clips,
// games, features) and drops the scene types the brand doesn't use (brand.json `scenes`).
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BRAND } from '../src/brand'

const ROOT = resolve(import.meta.dirname, '..')

// Scenes that need a brand list, and which one.
const NEEDS: Record<string, [keyof typeof BRAND, string]> = {
  match: ['avatars', 'avatars'],
  call: ['avatars', 'avatars'],
  chat: ['avatars', 'avatars'],
  appclip: ['clips', 'clips'],
  games: ['games', 'games'],
  features: ['features', 'features'],
}

export function reelSchema() {
  const s = JSON.parse(readFileSync(join(ROOT, 'reel.schema.json'), 'utf8'))
  for (const t of BRAND.scenes) {
    const need = NEEDS[t]
    const list = need && BRAND[need[0]]
    if (need && (!list || !Object.keys(list).length))
      throw new Error(`brand.json enables the "${t}" scene but has no ${need[1]}; add some or remove "${t}" from scenes`)
  }
  s.definitions.scene.oneOf = s.definitions.scene.oneOf.filter((x: any) => BRAND.scenes.includes(x.properties.type.const))
  // prompts/craft.md already describes each scene; don't send it twice on every call.
  for (const x of s.definitions.scene.oneOf)
    delete x.description
  s.definitions.avatar.enum = Object.keys(BRAND.avatars).length ? Object.keys(BRAND.avatars) : ['none']
  s.definitions.feature.enum = Object.keys(BRAND.features).length ? Object.keys(BRAND.features) : ['none']
  for (const x of s.definitions.scene.oneOf) {
    if (x.properties.type.const === 'appclip')
      x.properties.clip.enum = Object.keys(BRAND.clips)
    if (x.properties.type.const === 'games')
      x.properties.pick.enum = BRAND.games.map(g => g.id)
  }
  return s
}
