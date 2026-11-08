// Contact sheet for layout checks: one frame per scene, with the platform UI zones drawn.
//
//   npx tsx scripts/stills.ts brand/examples/allscenes.json [out/sheet.png]
//
// Renders the reel silently (voice lengths guessed), grabs each scene near the end of its
// animation with captions showing, and tiles them into one image.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { Reel, ReelProps } from '../src/types'
import { sceneSecs } from '../src/Reel'
import { syncAssets } from './assets'

const ROOT = resolve(import.meta.dirname, '..')
const file = process.argv[2] ?? 'brand/examples/allscenes.json'
const id = basename(file, '.json')
const sheet = process.argv[3] ?? join(ROOT, 'out', `${id}-sheet.png`)
const reel: Reel = JSON.parse(readFileSync(file, 'utf8'))
const voSecs = reel.scenes.map(s => (s.say ? s.say.split(/\s+/).length * 0.36 : null))
const props: ReelProps = { reel, audioDir: null, voSecs, guides: !process.argv.includes('--clean') }
const secs = sceneSecs(props)

syncAssets()
const dir = join(ROOT, 'out', `${id}-stills`)
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })
const propsFile = join(dir, 'props.json')
writeFileSync(propsFile, JSON.stringify(props))

// Frame per scene: late enough that everything has animated in, while the caption still shows.
let at = 0
const frames = secs.map((s, i) => {
  const vo = voSecs[i]
  const t = vo ? Math.min(s - 0.3, 0.25 + vo * 0.85) : s - 0.4
  const f = Math.round((at + Math.max(t, Math.min(s - 0.3, 1.8))) * 30)
  at += s - 8 / 30
  return f
})
for (const [i, f] of frames.entries())
  execFileSync('npx', ['remotion', 'still', 'Reel', join(dir, `${String(i).padStart(2, '0')}.png`), `--props=${propsFile}`, `--frame=${f}`, '--scale=0.5', '--log=error'], { cwd: ROOT, stdio: 'inherit' })
const cols = Math.min(7, frames.length)
execFileSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', join(dir, '*.png'), '-vf', `tile=${cols}x${Math.ceil(frames.length / cols)}:padding=12:color=white`, '-frames:v', '1', sheet])
console.log(sheet)
