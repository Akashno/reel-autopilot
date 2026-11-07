// Schedules the day's video on every channel through Buffer.
//
//   npm run post -- <date>                         schedule for <date> at postAt (India time)
//   npm run post -- <date> --dry                   print what would be sent
//   npm run post -- <date> --only instagram        one channel
//   npm run post -- <date> --at 2026-12-20T13:30:00Z --url https://...mp4
//   npm run post -- <date> --status                show each saved post's status
//   npm run post -- <date> --delete                delete the saved posts (tests)
//
// Needs BUFFER_API_KEY_1 / BUFFER_API_KEY_2 (environment or .env). What was scheduled is saved
// in data/posts/<date>.json, so a re-run never posts a channel twice.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Reel } from '../src/types'

const ROOT = resolve(import.meta.dirname, '..')
const PAGES = process.env.PAGES_URL ?? 'https://akashno.github.io/randomtalker-autopilot'

interface Channel { service: 'instagram' | 'youtube' | 'facebook' | 'twitter', name: string, id: string, key: string }
interface Config { postAt: string, timezoneOffsetMinutes: number, channels: Channel[] }
interface Saved { id: string, dueAt: string, status: string, error?: string }

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

async function gql(keyName: string, query: string, variables: Record<string, unknown>) {
  const key = process.env[keyName]
  if (!key)
    throw new Error(`${keyName} is not set`)
  for (let attempt = 1; ; attempt++) {
    const res = await fetch('https://api.buffer.com', {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    })
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const wait = Number(res.headers.get('retry-after')) || 20
      await new Promise(r => setTimeout(r, Math.min(wait, 120) * 1000))
      continue
    }
    const body: any = await res.json().catch(() => ({}))
    if (!res.ok || body.errors)
      throw new Error(`Buffer ${res.status}: ${JSON.stringify(body.errors ?? body).slice(0, 300)}`)
    return body.data
  }
}

const CREATE = `mutation Create($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status dueAt } }
    ... on MutationError { message }
  }
}`
const STATUS = `query Status($input: PostInput!) { post(input: $input) { id status dueAt sentAt externalLink error { message } } }`
const DELETE = `mutation Delete($input: DeletePostInput!) { deletePost(input: $input) { __typename ... on MutationError { message } } }`

// The text and network settings for one channel.
export function postInput(ch: Channel, reel: Reel, url: string, dueAt: string) {
  const tags = reel.post.hashtags.join(' ')
  const caption = `${reel.post.caption.trim()}\n\n${tags}`
  const base = {
    channelId: ch.id,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt,
    needsApproval: false,
    source: 'randomtalker-autopilot',
    assets: [{ video: { url, metadata: { thumbnailOffset: 1200 } } }],
  }
  switch (ch.service) {
    case 'instagram':
      return { ...base, text: caption, metadata: { instagram: { type: 'reel', shouldShareToFeed: true } } }
    case 'facebook':
      return { ...base, text: caption, metadata: { facebook: { type: 'reel' } } }
    case 'youtube':
      return { ...base, text: caption, metadata: { youtube: { title: reel.post.youtubeTitle.slice(0, 100), categoryId: '22', privacy: 'public', madeForKids: false, notifySubscribers: true } } }
    case 'twitter': {
      const extra = ' #randomtalker'
      const text = reel.post.xText.length + extra.length <= 280 && !/#randomtalker/i.test(reel.post.xText) ? reel.post.xText + extra : reel.post.xText
      return { ...base, text }
    }
  }
}

// postAt on `date` in India time, as UTC; never less than 10 minutes from now.
export function dueAtFor(date: string, cfg: Config) {
  const [h, m] = cfg.postAt.split(':').map(Number)
  const at = Date.parse(`${date}T00:00:00Z`) + (h * 60 + m - cfg.timezoneOffsetMinutes) * 60e3
  return new Date(Math.max(at, Date.now() + 10 * 60e3)).toISOString()
}

export async function post(date: string, opts: { only?: string, at?: string, url?: string, dry?: boolean } = {}) {
  loadEnv()
  const cfg: Config = JSON.parse(readFileSync(join(ROOT, 'data/channels.json'), 'utf8'))
  const reel: Reel = JSON.parse(readFileSync(join(ROOT, 'reels', `${date}.json`), 'utf8'))
  const url = opts.url ?? `${PAGES}/${date}.mp4`
  const dueAt = opts.at ?? dueAtFor(date, cfg)
  const savedFile = join(ROOT, 'data/posts', `${date}.json`)
  const saved: Record<string, Saved> = existsSync(savedFile) ? JSON.parse(readFileSync(savedFile, 'utf8')) : {}

  if (!opts.dry) {
    const head = await fetch(url, { method: 'HEAD' })
    if (!head.ok || !(head.headers.get('content-type') ?? '').startsWith('video/mp4'))
      throw new Error(`${url} is not serving the video (${head.status} ${head.headers.get('content-type')})`)
  }

  const failures: string[] = []
  for (const ch of cfg.channels.filter(c => !opts.only || c.service === opts.only)) {
    if (saved[ch.service] && saved[ch.service].status !== 'error') {
      console.log(`  ${ch.service}: already scheduled (${saved[ch.service].id})`)
      continue
    }
    const input = postInput(ch, reel, url, dueAt)
    if (opts.dry) {
      console.log(`  ${ch.service} (${ch.key}):\n${JSON.stringify(input, null, 2).replace(/^/gm, '    ')}`)
      continue
    }
    try {
      const r = (await gql(ch.key, CREATE, { input })).createPost
      if (r.__typename !== 'PostActionSuccess')
        throw new Error(`${r.__typename}: ${r.message ?? ''}`)
      saved[ch.service] = { id: r.post.id, dueAt: r.post.dueAt, status: r.post.status }
      console.log(`  ${ch.service}: ${r.post.status} for ${r.post.dueAt} (${r.post.id})`)
    }
    catch (err) {
      failures.push(`${ch.service}: ${(err as Error).message}`)
      console.log(`  ${ch.service}: FAILED ${(err as Error).message}`)
    }
    mkdirSync(join(ROOT, 'data/posts'), { recursive: true })
    writeFileSync(savedFile, `${JSON.stringify(saved, null, 2)}\n`)
  }
  return { failures, saved }
}

export async function status(date: string) {
  loadEnv()
  const cfg: Config = JSON.parse(readFileSync(join(ROOT, 'data/channels.json'), 'utf8'))
  const savedFile = join(ROOT, 'data/posts', `${date}.json`)
  const saved: Record<string, Saved> = existsSync(savedFile) ? JSON.parse(readFileSync(savedFile, 'utf8')) : {}
  const out: Record<string, { status: string, link?: string, error?: string }> = {}
  for (const [service, s] of Object.entries(saved)) {
    const ch = cfg.channels.find(c => c.service === service)!
    const p = (await gql(ch.key, STATUS, { input: { id: s.id } })).post
    out[service] = { status: p?.status ?? 'missing', link: p?.externalLink ?? undefined, error: p?.error?.message ?? undefined }
  }
  return out
}

async function remove(date: string) {
  loadEnv()
  const cfg: Config = JSON.parse(readFileSync(join(ROOT, 'data/channels.json'), 'utf8'))
  const savedFile = join(ROOT, 'data/posts', `${date}.json`)
  const saved: Record<string, Saved> = existsSync(savedFile) ? JSON.parse(readFileSync(savedFile, 'utf8')) : {}
  for (const [service, s] of Object.entries(saved)) {
    const ch = cfg.channels.find(c => c.service === service)!
    const r = (await gql(ch.key, DELETE, { input: { id: s.id } })).deletePost
    console.log(`  ${service}: ${r.__typename}${r.message ? ` ${r.message}` : ''}`)
    if (r.__typename === 'DeletePostSuccess')
      delete saved[service]
  }
  writeFileSync(savedFile, `${JSON.stringify(saved, null, 2)}\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const opt = (n: string) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : undefined
  }
  const date = args[0]
  if (!date || date.startsWith('--')) {
    console.error('Usage: npm run post -- <date> [--dry] [--only <service>] [--at <ISO>] [--url <mp4>] [--status] [--delete]')
    process.exit(1)
  }
  if (args.includes('--status') || args.includes('--check')) {
    const s = await status(date)
    console.log(JSON.stringify(s, null, 2))
    // --check: fail when a post errored or vanished, so the workflow can open an issue.
    const bad = Object.entries(s).filter(([, v]) => v.status === 'error' || v.status === 'missing')
    if (args.includes('--check') && bad.length) {
      console.error(`✗ ${bad.map(([k, v]) => `${k}: ${v.status}${v.error ? ` (${v.error})` : ''}`).join('; ')}`)
      process.exit(1)
    }
  }
  else if (args.includes('--delete')) {
    await remove(date)
  }
  else {
    const r = await post(date, { only: opt('--only'), at: opt('--at'), url: opt('--url'), dry: args.includes('--dry') })
    if (r.failures.length) {
      console.error(`✗ ${r.failures.length} channel(s) failed:\n  ${r.failures.join('\n  ')}`)
      process.exit(1)
    }
    // Mark the day as posted in the history.
    if (!args.includes('--dry') && !opt('--only')) {
      const file = join(ROOT, 'data/history.json')
      const history = JSON.parse(readFileSync(file, 'utf8'))
      for (const h of history) {
        if (h.date === date && h.status !== 'test')
          h.status = 'posted'
      }
      writeFileSync(file, `${JSON.stringify(history, null, 2)}\n`)
    }
  }
}
