// The whole day: write the reel, render it, record it in data/history.json.
//
//   npm run daily                       today (in the brand.json timezone)
//   npm run daily -- --date 2026-11-09  another day
//   npm run daily -- --test             mark the history entry as a test
//
// If the render fails its checks, the day's reel is rewritten once and rendered again.
// A good render is recorded as "rendered"; scripts/post.ts marks it "posted".
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { make } from './make'
import { record, today, write } from './write'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const date = arg('--date') ?? today()
const test = process.argv.includes('--test')

for (let round = 1; round <= 2; round++) {
  const file = `reels/${date}.json`
  // Reuse a reel already written for this date (e.g. a re-run after a render failure) on round 1.
  let reelFile = round === 1 && existsSync(file) ? file : undefined
  if (!reelFile) {
    const w = await write(date)
    if (!w.ok) {
      console.error(`✗ ${date}: could not write a reel\n  ${w.errors.join('\n  ')}`)
      process.exit(1)
    }
    reelFile = w.file
  }
  const m = await make(reelFile)
  if (m.ok) {
    record(date, JSON.parse(readFileSync(reelFile, 'utf8')), test ? 'test' : 'rendered')
    // Tell the GitHub workflow which day this was.
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `date=${date}\nmp4=${m.mp4}\n`)
    console.log(`✓ ${date}: ${m.mp4} (${m.duration.toFixed(1)}s, voice: ${m.engine})`)
    process.exit(0)
  }
  console.error(`  render failed (round ${round}):\n    ${m.errors.join('\n    ')}`)
  if (round === 1 && existsSync(file)) {
    const { rmSync } = await import('node:fs')
    rmSync(file) // write a fresh one
  }
}
console.error(`✗ ${date}: no good video today`)
process.exit(1)
