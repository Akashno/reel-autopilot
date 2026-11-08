// Everything about the product being advertised lives in brand/. Code reads it only through here.
import raw from '../brand/brand.json'

export interface Brand {
  name: string
  site: string // shown on the end card and required in captions
  hashtag: string // required in every post
  pitch: string // one line: what the product is
  goal: string // what the videos should make people want
  audience: string
  timezone: { label: string, offsetMinutes: number }
  postAt: string // HH:MM in that timezone
  endCard: { sub: string }
  commonWords: string[] // words every video uses; ignored when comparing ideas for novelty
  voice: { gemini: { voice: string, style: string } }
  colors: { bg: string, card: string, border: string, ink: string, muted: string, soft: string, gold: string, sun: string, glow: string, green: string, callGreen: string, red: string, tints: string[] }
  fonts: { display: string, body: string, files: Array<{ family: string, file: string, weight: number }> }
  logo: string
  scenes: string[] // scene types this brand uses
  productScenes: string[] // at least one of these must appear (shows the product)
  avatars: Record<string, { file: string, tint: string }>
  clips: Record<string, { file: string, from: number, to: number, length: number, about: string }>
  games: Array<{ id: string, name: string, file: string }>
  features: Record<string, { icon: string, label: string }>
  bannedClaims: string[] // regular expressions, matched case-insensitively
}

export const BRAND = raw as Brand

// Brand assets are copied from brand/assets/ to public/brand/ before rendering (scripts/assets.ts).
export const asset = (file: string) => `brand/${file}`
