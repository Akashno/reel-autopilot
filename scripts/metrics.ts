// How each posted video actually did, pulled from Buffer (no Claude tokens), and a short
// scoreboard the writer reads so it makes more of what people watch and send.
//
//   npm run metrics              refresh data/metrics.json for videos posted in the last 21 days
//   npm run metrics -- --show    print the scoreboard the writer gets
//
// Needs BUFFER_API_KEY_1 / _2 (environment or .env). Numbers settle after about a week, so a
// video fetched 8+ days after it went out is final and never fetched again.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { postTime } from './slot.mjs'

const ROOT = resolve(import.meta.dirname, '..')
const FILE = join(ROOT, 'data/metrics.json')
const DAY = 864e5
// Only these are read: Instagram is where the audience is; Facebook and YouTube for context.
const SERVICES = ['instagram', 'facebook', 'youtube'] as const
type Service = typeof SERVICES[number]
type Stats = Record<string, number>
interface Entry { fetchedAt: string, final?: boolean, stats: Partial<Record<Service, Stats>> }

export const loadMetrics = (): Record<string, Entry> => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {})

function loadEnv() {
  const env = join(ROOT, '.env')
  if (!existsSync(env))
    return
  for (const line of readFileSync(env, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]])
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const channelKey = (service: string) => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'brand/channels.json'), 'utf8'))
  return cfg.channels.find((c: any) => c.service === service)?.key as string | undefined
}

async function postMetrics(key: string, id: string): Promise<Stats | null> {
  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: { 'Authorization': `Bearer ${process.env[key]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($id:PostId!){post(input:{id:$id}){metrics{type value}}}', variables: { id } }),
  })
  const body: any = await res.json().catch(() => ({}))
  const m = body?.data?.post?.metrics
  if (!res.ok || !Array.isArray(m))
    return null
  return Object.fromEntries(m.map((x: any) => [x.type, Number(x.value) || 0]))
}

export async function refresh() {
  loadEnv()
  const metrics = loadMetrics()
  const now = Date.now()
  let n = 0
  for (const f of readdirSync(join(ROOT, 'data/posts')).filter(f => f.endsWith('.json')).sort()) {
    const id = f.replace('.json', '')
    const age = now - postTime(id)
    if (age < 0.5 * DAY || age > 21 * DAY || metrics[id]?.final)
      continue
    const saved = JSON.parse(readFileSync(join(ROOT, 'data/posts', f), 'utf8'))
    const stats: Entry['stats'] = {}
    for (const s of SERVICES) {
      const key = channelKey(s)
      if (!saved[s]?.id || !key || !process.env[key])
        continue
      const got = await postMetrics(key, saved[s].id)
      if (got)
        stats[s] = got
    }
    if (Object.keys(stats).length) {
      metrics[id] = { fetchedAt: new Date(now).toISOString(), final: age > 8 * DAY, stats }
      n++
    }
  }
  writeFileSync(FILE, `${JSON.stringify(metrics, null, 2)}\n`)
  console.log(`metrics: refreshed ${n} videos -> data/metrics.json`)
}

// ---- scoreboard --------------------------------------------------------------------------

// What counts: people sending, saving and commenting (that is what gets a reel shown to
// non-followers), then how long they watched.
const score = (s: Stats) => (s.shares ?? 0) * 5 + (s.saves ?? 0) * 3 + (s.comments ?? 0) * 3 + (s.averageTimeWatched ?? 0)

function formatOf(id: string): string {
  const f = join(ROOT, 'reels', `${id}.json`)
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).idea?.format ?? 'skit' : 'skit'
}

// A few lines for the writer's prompt; empty until there is data.
export function scoreboard(history: Array<{ date: string, title: string, hook: string }>): string {
  const metrics = loadMetrics()
  const rows = history
    .filter(h => metrics[h.date]?.stats.instagram)
    .map(h => ({ ...h, format: formatOf(h.date), ig: metrics[h.date].stats.instagram! }))
  if (rows.length < 3)
    return ''
  const fmt = (r: typeof rows[number]) => `"${r.hook}" [${r.format}]: ${r.ig.views ?? 0} views, ${(r.ig.averageTimeWatched ?? 0).toFixed(1)}s avg watch, ${r.ig.shares ?? 0} sends, ${r.ig.saves ?? 0} saves, ${r.ig.comments ?? 0} comments`
  const groups: Record<string, typeof rows> = {}
  for (const r of rows)
    (groups[r.format] ??= []).push(r)
  const byFormat = Object.entries(groups).map(([f, rs]) => {
    const avg = (k: string) => rs!.reduce((n, r) => n + (r.ig[k] ?? 0), 0) / rs!.length
    return `- ${f} (${rs!.length} videos): ${avg('views').toFixed(0)} views, ${avg('averageTimeWatched').toFixed(1)}s avg watch, ${avg('shares').toFixed(1)} sends, ${avg('comments').toFixed(1)} comments`
  })
  const ranked = [...rows].sort((a, b) => score(b.ig) - score(a.ig))
  return [
    '# How recent videos did on Instagram (sends, saves and comments matter most, then watch time)',
    ...byFormat,
    'Best:',
    ...ranked.slice(0, 3).map(r => `- ${fmt(r)}`),
    'Worst:',
    ...ranked.slice(-3).reverse().map(r => `- ${fmt(r)}`),
    'Learn from the best hooks and endings; avoid what the worst have in common.',
  ].join('\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.argv.includes('--show'))
    await refresh()
  const history = existsSync(join(ROOT, 'data/history.json')) ? JSON.parse(readFileSync(join(ROOT, 'data/history.json'), 'utf8')) : []
  if (process.argv.includes('--show'))
    console.log(scoreboard(history.slice(-40)) || '(not enough data yet)')
}
