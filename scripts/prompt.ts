// Fills the {{placeholders}} in prompts/ and brand/brief.md from brand/brand.json, and drops
// scene-library lines for scene types the brand doesn't use.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BRAND } from '../src/brand'

const ROOT = resolve(import.meta.dirname, '..')

export function fill(text: string) {
  const on = (t: string) => BRAND.scenes.includes(t)
  const vars: Record<string, string> = {
    name: BRAND.name,
    site: BRAND.site,
    hashtag: BRAND.hashtag,
    pitch: BRAND.pitch,
    goal: BRAND.goal,
    audience: BRAND.audience,
    clips: Object.entries(BRAND.clips).map(([id, c]) => `\`${id}\` (${c.about})`).join(', '),
    games: BRAND.games.map(g => `\`${g.id}\` (${g.name})`).join(', '),
    features: Object.entries(BRAND.features).map(([id, f]) => `\`${id}\` ("${f.label}")`).join(', '),
    avatars: Object.keys(BRAND.avatars).join(', '),
    productScenes: BRAND.productScenes.filter(on).join(', '),
  }
  return text
    .split('\n')
    .filter((line) => {
      const m = line.match(/^- `([a-z]+)`:/)
      return !m || on(m[1])
    })
    .filter(line => !(line.startsWith('Avatars:') && !Object.keys(BRAND.avatars).length))
    .join('\n')
    .replace(/\{\{(\w+)\}\}/g, (all, k: string) => vars[k] ?? all)
}

export const prompt = (path: string) => fill(readFileSync(join(ROOT, path), 'utf8'))
