// Reel JSON -> finished MP4.
//
//   npm run make -- brand/examples/sample.json            check, voice, render, verify -> out/<name>.mp4
//   npm run make -- brand/examples/sample.json --piper    skip Gemini, voice with Piper
//   npm run make -- brand/examples/sample.json --silent   no voice (layout checks)
//
// Exit codes: 2 reel failed the checks, 3 the rendered file failed verification.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Reel, ReelProps } from '../src/types'
import { syncAssets } from './assets'
import { checkReel } from './check'
import { voice } from './voice'

const ROOT = resolve(import.meta.dirname, '..')

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

export async function make(file: string, opts: { silent?: boolean, piper?: boolean } = {}) {
  loadEnv()
  const id = basename(file, '.json')
  const reel: Reel = JSON.parse(readFileSync(file, 'utf8'))
  const problems = checkReel(reel)
  if (problems.length)
    return { ok: false as const, code: 2, errors: problems }

  const runDir = `runs/${id}`
  let voSecs: Array<number | null>
  let engine = 'none'
  if (opts.silent) {
    voSecs = reel.scenes.map(s => (s.say ? s.say.split(/\s+/).length * 0.36 : null))
  }
  else {
    console.log('Voice:')
    const v = await voice(reel, runDir, opts.piper ? 'piper' : 'gemini')
    voSecs = v.secs
    engine = v.engine
  }

  syncAssets()
  mkdirSync(join(ROOT, 'out'), { recursive: true })
  const props: ReelProps = { reel, audioDir: opts.silent ? null : runDir, voSecs }
  const propsFile = join(ROOT, 'out', `${id}.props.json`)
  writeFileSync(propsFile, JSON.stringify(props))
  const mp4 = join(ROOT, 'out', `${id}.mp4`)
  console.log(`Rendering ${mp4}`)
  execFileSync('npx', ['remotion', 'render', 'Reel', mp4, `--props=${propsFile}`, '--log=error'], { cwd: ROOT, stdio: 'inherit' })

  // Verify the file before anything posts it.
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', mp4]).toString())
  const duration = Number(probe.format.duration)
  const video = probe.streams.find((s: any) => s.codec_type === 'video')
  const errors: string[] = []
  if (duration < 12 || duration > 45)
    errors.push(`duration ${duration.toFixed(1)}s is outside 12-45s`)
  if (video?.width !== 1080 || video?.height !== 1920)
    errors.push(`frame is ${video?.width}x${video?.height}, expected 1080x1920`)
  if (!opts.silent) {
    if (!probe.streams.some((s: any) => s.codec_type === 'audio'))
      errors.push('no audio track')
    const stderr = spawnSync('ffmpeg', ['-v', 'info', '-i', mp4, '-af', 'volumedetect', '-f', 'null', '-']).stderr.toString()
    const mean = Number((stderr.match(/mean_volume: (-?[\d.]+)/) ?? [])[1])
    if (!(mean > -35))
      errors.push(`audio is too quiet (mean ${mean} dB)`)
  }
  if (errors.length)
    return { ok: false as const, code: 3, errors }
  return { ok: true as const, mp4, duration, engine }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2]
  if (!file) {
    console.error('Usage: npm run make -- <reel.json> [--piper | --silent]')
    process.exit(1)
  }
  const r = await make(file, { silent: process.argv.includes('--silent'), piper: process.argv.includes('--piper') })
  if (!r.ok) {
    console.error(`✗ ${file}\n  ${r.errors.join('\n  ')}`)
    process.exit(r.code)
  }
  console.log(`✓ ${r.mp4}  ${r.duration.toFixed(1)}s  voice: ${r.engine}`)
}
