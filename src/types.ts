// The daily reel as Claude writes it. Mirrors reel.schema.json, which is what actually checks it.
// Ids from brand/brand.json (avatars, features, games, clips); the schema lists the allowed values.
export type Avatar = string
export type Feature = string
export type Game = string
export type Clip = string

interface Base { say?: string }
export type Scene = Base & (
  | { type: 'hook', lines: string[], highlight?: string }
  | { type: 'pov', text: string }
  | { type: 'bigword', word: string, sub?: string }
  | { type: 'question', question: string, a: string, b: string }
  | { type: 'match', avatar: Avatar, name: string }
  | { type: 'call', avatar: Avatar, name: string, label?: string }
  | { type: 'chat', avatar: Avatar, name: string, messages: Array<{ from: 'me' | 'them', text: string }> }
  | { type: 'appclip', clip: Clip, headline: string, sub?: string }
  | { type: 'games', pick: Game, headline?: string }
  | { type: 'features', headline?: string, items: Feature[] }
  | { type: 'list', title: string, items: string[] }
  | { type: 'rating', title: string, items: Array<{ label: string, stars: number }> }
  | { type: 'versus', left: { label: string, text: string }, right: { label: string, text: string } }
  | { type: 'end', tagline: string }
)
export type SceneType = Scene['type']

export interface Reel {
  idea: { hookOptions?: string[], title: string, angle: string, summary: string }
  scenes: Scene[]
  post: { caption: string, hashtags: string[], youtubeTitle: string, xText: string }
}

// What the renderer gets: the reel plus where its voice clips are and how long each one runs.
export interface ReelProps extends Record<string, unknown> {
  reel: Reel
  audioDir: string | null // under public/, e.g. runs/2026-11-08; null renders silent
  voSecs: Array<number | null> // per scene
  guides?: boolean // draw the platform UI zones (layout checks only)
}
