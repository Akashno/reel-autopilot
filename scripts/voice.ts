// Voiceover for a reel: one clip per scene line, written to public/<runDir>/s<i>.wav.
//
// Gemini text-to-speech first, as ONE request for the whole script (the free tier allows only
// about ten requests a day), cut into lines at the long pauses between them. If Gemini fails,
// is out of quota, or the cut doesn't line up with the script, every line is voiced locally
// with Piper instead, which is free and has no limits.
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BRAND } from '../src/brand'
import type { Reel } from '../src/types'

const ROOT = resolve(import.meta.dirname, '..')
// Voice and speaking style come from brand.json; the pause instruction is what makes the cut work.
const GEMINI = {
  voice: BRAND.voice.gemini.voice,
  style: `${BRAND.voice.gemini.style} Leave a long pause wherever it says <long pause>; never read that out.`,
  model: 'gemini-3.8-flash-tts',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/interactions',
}
const PIPER = {
  bin: process.env.PIPER_BIN ?? join(ROOT, '.venv/bin/piper'),
  model: process.env.PIPER_VOICE ?? join(ROOT, 'voices/en_US-ryan-high.onnx'),
}

export function seconds(path: string) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).toString().trim())
}

// Trim silence at both ends and match loudness across clips.
function clean(input: string, out: string, from?: number, to?: number) {
  const range = from != null && to != null ? ['-ss', from.toFixed(3), '-to', to.toFixed(3)] : []
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...range, '-i', input, '-af', [
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
    'areverse',
    'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
    'areverse',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    'aresample=48000',
  ].join(','), out])
}

async function geminiTake(texts: string[], out: string) {
  const key = process.env.GEMINI_API_KEY
  if (!key)
    throw new Error('GEMINI_API_KEY is not set')
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(GEMINI.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(120_000),
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMINI.model,
        input: [{ type: 'user_input', content: [{ type: 'text', text: texts.join('\n\n<long pause>\n\n'), annotations: [{ type: 'speech_metadata', style: GEMINI.style }] }] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: GEMINI.voice }] },
      }),
    })
    // A short wait is worth it; a long one means the day's quota is gone.
    const wait = Number(res.headers.get('retry-after')) || 30
    if ((res.status === 429 || res.status >= 500) && attempt < 3 && wait <= 120) {
      console.log(`  gemini ${res.status}, retrying in ${wait}s`)
      await new Promise(r => setTimeout(r, wait * 1000))
      continue
    }
    if (!res.ok)
      throw new Error(`gemini ${res.status}${res.status === 429 ? ` (quota, retry after ${Math.round(wait / 60)} min)` : ''}: ${(await res.text()).slice(0, 200)}`)
    const body: any = await res.json()
    const audio = (body.steps ?? []).filter((s: any) => s.type === 'model_output').flatMap((s: any) => s.content ?? []).filter((c: any) => c.type === 'audio').at(-1)
    if (!audio?.data)
      throw new Error('gemini returned no audio')
    writeFileSync(out, Buffer.from(audio.data, 'base64'))
    return
  }
}

// Cut points between lines: for each break, the long pause nearest where an even reading
// pace puts it, chosen in order. Throws when the take doesn't line up with the script.
function cutPoints(take: string, texts: string[]): number[] {
  const total = seconds(take)
  const detect = spawnSync('ffmpeg', ['-i', take, '-af', 'silencedetect=n=-40dB:d=0.25', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const starts = [...detect.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]))
  const ends = [...detect.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]))
  const all = starts.map((s, i) => [s, ends[i] ?? total] as const)
  // Speech runs from the end of any leading silence to the start of any trailing one.
  const from = all[0] && all[0][0] <= 0.05 ? all[0][1] : 0
  const last = all.at(-1)
  const to = last && last[1] >= total - 0.05 ? last[0] : total
  const pauses = all.filter(([s, e]) => s > from && e < to && e - s >= 0.2).map(([s, e]) => ({ mid: (s + e) / 2, len: e - s }))
  const n = texts.length
  const need = n - 1
  if (pauses.length < need)
    throw new Error(`take has ${pauses.length} pauses for ${n} lines`)

  // Where each line break should fall: speech time split by characters, plus one typical
  // between-line pause per break (the mean of the longest `need` pauses).
  const gap = [...pauses].sort((a, b) => b.len - a.len).slice(0, need).reduce((s, p) => s + p.len, 0) / Math.max(1, need)
  const chars = texts.map(t => t.length)
  const sum = chars.reduce((a, b) => a + b, 0)
  const speech = Math.max(1, to - from - need * gap)
  let acc = 0
  const expected = chars.slice(0, need).map((c, k) => {
    acc += c
    return from + speech * acc / sum + k * gap + gap / 2
  })

  // Pick one pause per break, in order, closest to where it should be and favouring long
  // pauses (dynamic programming over breaks x pauses).
  const cost = (k: number, j: number) => Math.abs(pauses[j].mid - expected[k]) - 1.5 * pauses[j].len
  const P = pauses.length
  const best: number[][] = Array.from({ length: need }, () => Array.from({ length: P }, () => Infinity))
  const prev: number[][] = Array.from({ length: need }, () => Array.from({ length: P }, () => -1))
  for (let j = 0; j < P; j++) best[0][j] = cost(0, j)
  for (let k = 1; k < need; k++) {
    for (let j = k; j < P; j++) {
      for (let i = k - 1; i < j; i++) {
        const c = best[k - 1][i] + cost(k, j)
        if (c < best[k][j]) {
          best[k][j] = c
          prev[k][j] = i
        }
      }
    }
  }
  let j = best[need - 1].indexOf(Math.min(...best[need - 1]))
  const picked: number[] = []
  for (let k = need - 1; k >= 0; k--) {
    picked.unshift(j)
    j = prev[k][j]
  }
  const chosen = picked.map(i => pauses[i])
  if (chosen.some(p => p.len < 0.3))
    throw new Error('a line break falls on a very short pause; the take may not match the script')

  // Each piece should be within a generous band of its share of the speech.
  const bounds = [0, ...chosen.map(p => p.mid), total]
  texts.forEach((_, i) => {
    const got = bounds[i + 1] - bounds[i]
    const expect = speech * chars[i] / sum + gap
    if (got < expect * 0.5 || got > expect * 2)
      throw new Error(`line ${i + 1} cut to ${got.toFixed(1)}s, expected about ${expect.toFixed(1)}s`)
  })
  return bounds
}

// Exported for testing the cuts against saved takes.
export const _cutPoints = cutPoints

function piper(text: string, out: string) {
  if (!existsSync(PIPER.bin) || !existsSync(PIPER.model))
    throw new Error(`Piper is not installed (${PIPER.bin}, ${PIPER.model})`)
  const r = spawnSync(PIPER.bin, ['-m', PIPER.model, '-f', out, '--length-scale', '0.92', '--sentence-silence', '0.15'], { input: text, encoding: 'utf8' })
  if (r.status !== 0)
    throw new Error(`piper failed: ${r.stderr.slice(0, 300)}`)
}

export type Engine = 'gemini' | 'piper'

// Voices every line; returns each scene's clip length (null where the scene has no line).
export async function voice(reel: Reel, runDir: string, prefer: Engine = 'gemini'): Promise<{ engine: Engine, secs: Array<number | null> }> {
  const dir = join(ROOT, 'public', runDir)
  mkdirSync(dir, { recursive: true })
  const lines = reel.scenes.map((s, i) => ({ i, text: s.say })).filter((l): l is { i: number, text: string } => !!l.text)
  const texts = lines.map(l => l.text)
  const hash = createHash('sha1').update(JSON.stringify([texts, GEMINI, PIPER.model])).digest('hex').slice(0, 12)
  const stamp = join(dir, 'voice.json')
  const done = existsSync(stamp) ? JSON.parse(readFileSync(stamp, 'utf8')) : null

  let engine: Engine = prefer
  if (done?.hash === hash && lines.every(l => existsSync(join(dir, `s${l.i}.wav`)))) {
    engine = done.engine
  }
  else {
    for (const f of lines.map(l => join(dir, `s${l.i}.wav`))) rmSync(f, { force: true })
    if (prefer === 'gemini') {
      try {
        const take = join(dir, 'take.wav')
        await geminiTake(texts, take)
        const bounds = cutPoints(take, texts)
        lines.forEach((l, k) => clean(take, join(dir, `s${l.i}.wav`), bounds[k], bounds[k + 1]))
      }
      catch (err) {
        console.log(`  Gemini voice failed (${(err as Error).message}); using Piper`)
        engine = 'piper'
      }
    }
    if (engine === 'piper') {
      for (const l of lines) {
        const raw = join(dir, `raw-s${l.i}.wav`)
        piper(l.text, raw)
        clean(raw, join(dir, `s${l.i}.wav`))
        rmSync(raw)
      }
    }
    writeFileSync(stamp, JSON.stringify({ hash, engine }))
  }

  const secs: Array<number | null> = reel.scenes.map(() => null)
  for (const l of lines) {
    secs[l.i] = seconds(join(dir, `s${l.i}.wav`))
    console.log(`  s${l.i}  ${secs[l.i]!.toFixed(2)}s  ${l.text}`)
  }
  return { engine, secs }
}
