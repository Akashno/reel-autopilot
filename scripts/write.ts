// Writes today's reel with headless Claude Code (your Claude subscription, no API key).
//
//   npm run write                         -> reels/<today>.json
//   npm run write -- --date 2026-11-09    for another day (tests, catch-up)
//
// Claude gets the brief, today's angle (the one used least recently), and the recent history,
// and must return JSON matching reel.schema.json. The result is checked (scripts/check.ts) and
// compared with past ideas; if anything fails, Claude is told exactly what and asked again.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Reel } from '../src/types'
import { BRAND } from '../src/brand'
import { checkReel } from './check'
import { prompt as loadPrompt } from './prompt'
import { reelSchema } from './schema'

const ROOT = resolve(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const MODEL = process.env.CLAUDE_MODEL ?? 'sonnet'
// Drafts per day, counting ones rejected by the hard checks. More rarely helps: see the critic loop.
const TRIES = 3

export interface HistoryEntry {
  date: string
  title: string
  angle: string
  summary: string
  hook: string
  scenes: string // "pov>rating>appclip>...>end"
  names?: string[] // stranger nicknames shown
  status: 'test' | 'rendered' | 'posted' | 'failed'
}
export const HISTORY = join(ROOT, 'data/history.json')
export const loadHistory = (): HistoryEntry[] => (existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : [])

// Today in the brand's timezone (brand.json), where most of the audience is.
export const today = () => new Date(Date.now() + BRAND.timezone.offsetMinutes * 60e3).toISOString().slice(0, 10)

// ---- novelty -----------------------------------------------------------------------------

const STOP = new Set([
  ...'a an the and or but of to in on at for with your you my me i is it its it\'s are be this that just no not one'.split(' '),
  ...BRAND.name.toLowerCase().split(/\s+/),
  ...BRAND.commonWords.map(w => w.toLowerCase()),
])
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)))
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size)
    return 0
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n / (a.size + b.size - n)
}

export function hookText(r: Reel) {
  const s = r.scenes[0]
  switch (s.type) {
    case 'hook': return s.lines.join(' ')
    case 'pov': return `POV: ${s.text.replace(/^\s*pov\s*[:\-]?\s*/i, '')}`
    case 'bigword': return `${s.word} ${s.sub ?? ''}`.trim()
    case 'question': return s.question
    default: return s.say ?? ''
  }
}
export const sceneList = (r: Reel) => r.scenes.map(s => s.type).join('>')
export const namesIn = (r: Reel) => [...new Set(r.scenes.flatMap(s => ('name' in s ? [s.name] : [])))]

function noveltyErrors(r: Reel, history: HistoryEntry[]): string[] {
  const errors: string[] = []
  const idea = words(`${r.idea.title} ${r.idea.summary} ${hookText(r)}`)
  const hook = words(hookText(r))
  for (const h of history.slice(-60)) {
    const sim = jaccard(idea, words(`${h.title} ${h.summary} ${h.hook}`))
    if (sim > 0.45)
      errors.push(`too similar to "${h.title}" (${h.date}): pick a different concept`)
    else if (jaccard(hook, words(h.hook)) > 0.6)
      errors.push(`the hook is too close to "${h.hook}" (${h.date}): write a new hook`)
  }
  const used = new Set(history.slice(-30).flatMap(h => h.names ?? []).map(n => n.toLowerCase()))
  for (const n of namesIn(r)) {
    if (used.has(n.toLowerCase()))
      errors.push(`nickname "${n}" was used recently: invent a new one`)
  }
  const structure = sceneList(r)
  const same = history.slice(-14).find(h => h.scenes === structure)
  if (same)
    errors.push(`same scene sequence as "${same.title}" (${same.date}): vary the structure`)
  const last = history.at(-1)
  if (last && last.scenes.split('>')[0] === r.scenes[0].type && history.at(-2)?.scenes.split('>')[0] === r.scenes[0].type)
    errors.push(`the last two videos also opened with "${r.scenes[0].type}": open with a different scene type`)
  return errors
}

// ---- prompt ------------------------------------------------------------------------------

function pickAngle(history: HistoryEntry[], date: string) {
  const angles: Array<{ id: string, brief: string }> = JSON.parse(read('brand/angles.json'))
  const lastUsed = (id: string) => history.filter(h => h.angle === id).map(h => h.date).sort().at(-1) ?? ''
  // Least recently used first; among never-used ones, rotate by date so the order varies.
  const seed = Number(date.replaceAll('-', ''))
  return [...angles].sort((a, b) => lastUsed(a.id).localeCompare(lastUsed(b.id)) || ((angles.indexOf(a) + seed) % angles.length) - ((angles.indexOf(b) + seed) % angles.length))[0]
}

// Novelty rules that depend on history, stated up front so no attempt is wasted on them.
function rulesToday(history: HistoryEntry[]) {
  const lines: string[] = []
  const firsts = history.slice(-2).map(h => h.scenes.split('>')[0])
  if (firsts.length === 2 && firsts[0] === firsts[1])
    lines.push(`- Do not open with "${firsts[0]}" today (the last two videos did).`)
  const recent = [...new Set(history.slice(-14).map(h => h.scenes))]
  if (recent.length)
    lines.push(`- Do not reuse any of these exact scene sequences: ${recent.join(' ; ')}`)
  return lines.length ? `# Rules for today\n\n${lines.join('\n')}` : ''
}

function buildPrompt(date: string, angle: { id: string, brief: string }, history: HistoryEntry[]) {
  const recent = history.slice(-30).reverse()
  return [
    '# Today',
    `Date: ${date}. Today's angle: **${angle.id}**: ${angle.brief}`,
    'Set idea.angle to exactly this angle id. Find a fresh, specific concept inside it; surprise me.',
    '# Recent videos (newest first). Do something clearly different from all of these.',
    recent.length
      ? recent.map(h => `- ${h.date} [${h.angle}] "${h.title}": ${h.summary} | hook: "${h.hook}" | scenes: ${h.scenes}`).join('\n')
      : '(none yet: this is the first one)',
    rulesToday(history),
    `Names already used: ${[...new Set(history.slice(-30).flatMap(h => h.names ?? []))].join(', ') || '(none yet)'}`,
  ].join('\n\n')
}

// ---- claude ------------------------------------------------------------------------------

function askClaude<T>(prompt: string, schema: string, system: string): { out?: T, error?: string, tokens?: string } {
  const r = spawnSync('claude', [
    '-p',
    '--model', MODEL,
    '--tools', '',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--output-format', 'json',
    '--json-schema', schema,
    '--system-prompt', system,
  ], { input: prompt, encoding: 'utf8', cwd: ROOT, timeout: 300_000, maxBuffer: 20 * 1024 * 1024 })
  if (r.error)
    return { error: `could not run claude: ${r.error.message}` }
  let out: any
  try {
    out = JSON.parse(r.stdout)
  }
  catch {
    return { error: `claude exited ${r.status}: ${(r.stderr || r.stdout).slice(0, 400)}` }
  }
  if (out.is_error || !out.structured_output)
    return { error: `claude returned nothing usable (${out.subtype ?? 'error'}): ${String(out.result ?? '').slice(0, 300)}` }
  const u = out.usage ?? {}
  // Fresh input and output are what count against usage limits most; cache reads are cheap.
  const n = (k: string) => u[k] ?? 0
  const total = n('input_tokens') + n('cache_creation_input_tokens') + n('cache_read_input_tokens') + n('output_tokens')
  return { out: out.structured_output, tokens: `${total} tokens: ${n('input_tokens')} in, ${n('cache_creation_input_tokens')} cache write, ${n('cache_read_input_tokens')} cache read, ${n('output_tokens')} out, ${Math.round((out.duration_ms ?? 0) / 1000)}s` }
}

// ---- critic ------------------------------------------------------------------------------

interface Review { hook: number, clarity: number, human: number, payoff: number, weakest: string, fixes: string[] }
const REVIEW_SCHEMA = JSON.stringify({
  type: 'object',
  additionalProperties: false,
  required: ['hook', 'clarity', 'human', 'payoff', 'weakest', 'fixes'],
  properties: {
    hook: { type: 'integer', minimum: 1, maximum: 10 },
    clarity: { type: 'integer', minimum: 1, maximum: 10 },
    human: { type: 'integer', minimum: 1, maximum: 10 },
    payoff: { type: 'integer', minimum: 1, maximum: 10 },
    weakest: { type: 'string', maxLength: 200 },
    fixes: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 240 } },
  },
})
// The hook matters most; the rest must be solid. Matched to how the critic actually scores
// (it calls 5-7 typical), so a strong first draft is kept instead of rewritten.
const passes = (r: Review) => r.hook >= 7 && Math.min(r.clarity, r.human, r.payoff) >= 6
const score = (r: Review) => r.hook * 2 + r.clarity + r.human + r.payoff

// What the viewer actually sees and hears, in order, for the critic.
function script(r: Reel) {
  return r.scenes.map((s, i) => {
    const { type, say, ...rest } = s as any
    return `${i + 1}. [${type}] screen: ${JSON.stringify(rest)}${say ? ` | voice: "${say}"` : ''}`
  }).join('\n')
}

function review(reel: Reel) {
  return askClaude<Review>(`Today's reel, "${reel.idea.title}" (${reel.idea.summary})\n\n${script(reel)}`, REVIEW_SCHEMA, loadPrompt('prompts/critic.md'))
}

export async function write(date: string): Promise<{ ok: true, file: string, reel: Reel } | { ok: false, errors: string[] }> {
  const history = loadHistory().filter(h => h.date < date)
  const angle = pickAngle(history, date)
  const base = buildPrompt(date, angle, history)
  const schema = JSON.stringify(reelSchema())
  // Everything that's the same on every attempt goes in the system prompt, so Claude caches it
  // once and later attempts only pay for what changed (today's context and the feedback).
  const system = [loadPrompt('prompts/system.md'), loadPrompt('brand/brief.md'), loadPrompt('prompts/craft.md')].join('\n\n')
  console.log(`Writing ${date}: angle "${angle.id}" (${MODEL})`)
  let prompt = base
  let errors: string[] = []
  // The best reel that passed every hard check, in case the critic never fully approves.
  let best: { reel: Reel, score: number } | undefined
  const save = (reel: Reel) => {
    mkdirSync(join(ROOT, 'reels'), { recursive: true })
    const file = join(ROOT, 'reels', `${date}.json`)
    writeFileSync(file, `${JSON.stringify(reel, null, 2)}\n`)
    return { ok: true as const, file, reel }
  }
  for (let attempt = 1; attempt <= TRIES; attempt++) {
    const res = askClaude<Reel>(prompt, schema, system)
    if (!res.out) {
      errors = [res.error!]
      console.log(`  attempt ${attempt}: ${res.error}`)
      // A login problem won't fix itself on retry.
      if (/authenticat|401|invalid api key|oauth/i.test(res.error!))
        break
      continue
    }
    const reel = res.out
    errors = [...checkReel(reel), ...noveltyErrors(reel, history)]
    if (!reel.idea.hookOptions?.length)
      errors.push('idea.hookOptions is missing: brainstorm the hooks first')
    if (reel.idea.angle !== angle.id)
      reel.idea.angle = angle.id // keep the rotation honest even if the label drifts
    console.log(`  attempt ${attempt}: "${reel.idea.title}" ${sceneList(reel)} (${res.tokens})${errors.length ? `, rejected:\n    ${errors.join('\n    ')}` : ''}`)
    if (!errors.length) {
      const rv = review(reel)
      if (!rv.out) {
        console.log(`  critic unavailable (${rv.error}); keeping this reel`)
        return save(reel)
      }
      const r = rv.out
      console.log(`  critic: hook ${r.hook}, clarity ${r.clarity}, human ${r.human}, payoff ${r.payoff} (${rv.tokens})`)
      if (passes(r))
        return save(reel)
      // A rewrite that scores no better than the best draft so far means the critic's fixes
      // have stopped helping; more rounds only burn tokens.
      if (best && score(r) <= best.score) {
        console.log(`  no better than the best draft so far (${score(r)} vs ${best.score}); stopping`)
        break
      }
      best = { reel, score: score(r) }
      errors = [
        `an editor scored it hook ${r.hook}/10, clarity ${r.clarity}/10, human ${r.human}/10, payoff ${r.payoff}/10; it needs hook 7+ and 6+ on the rest`,
        `weakest line: ${r.weakest}`,
        ...r.fixes.map(f => `fix: ${f}`),
      ]
      console.log(`    ${errors.slice(1).join('\n    ')}`)
    }
    prompt = `${base}\n\n# Your previous attempt was rejected\n\n${errors.map(e => `- ${e}`).join('\n')}\n\nPrevious attempt:\n${JSON.stringify(reel)}\n\nFix every problem and return a complete new reel.`
  }
  if (best) {
    console.log('  using the best reel that passed the checks')
    return save(best.reel)
  }
  return { ok: false, errors }
}

export function record(date: string, reel: Reel, status: HistoryEntry['status']) {
  const history = loadHistory().filter(h => h.date !== date)
  history.push({ date, title: reel.idea.title, angle: reel.idea.angle, summary: reel.idea.summary, hook: hookText(reel), scenes: sceneList(reel), names: namesIn(reel), status })
  history.sort((a, b) => a.date.localeCompare(b.date))
  mkdirSync(join(ROOT, 'data'), { recursive: true })
  writeFileSync(HISTORY, `${JSON.stringify(history, null, 2)}\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--date')
  const date = i > 0 ? process.argv[i + 1] : today()
  const r = await write(date)
  if (!r.ok) {
    console.error(`✗ no usable reel after ${TRIES} attempts:\n  ${r.errors.join('\n  ')}`)
    process.exit(1)
  }
  console.log(`✓ ${r.file}`)
}
