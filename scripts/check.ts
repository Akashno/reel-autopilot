// Validates a reel against reel.schema.json plus the rules a schema can't express.
//   npm run check -- reels/sample.json
import { readFileSync } from 'node:fs'
import Ajv from 'ajv'
import type { Reel } from '../src/types'

const schema = JSON.parse(readFileSync(new URL('../reel.schema.json', import.meta.url), 'utf8'))
const validate = new Ajv({ allErrors: true, strict: false }).compile(schema)

// Words that would make a claim the product can't back up.
const BANNED = [/\bvideo (call|chat)/i, /\bmillions?\b/i, /\b\d{2,}[k%+]/i, /\bguarantee/i, /\bAI[- ]powered\b/i, /\bdating\b/i, /\bhook ?up\b/i, /\bomegle (is back|clone|alternative by)\b/i, /\b100% (free|safe)\b/i, /\bcompletely (free|safe)\b/i, /\buntraceable\b/i, /\b(never|not) recorded\b/i]

// On-screen text: letters, digits, punctuation and spaces only. Emoji and symbols may have no
// font on the render machine. (Post captions are not drawn, so they may use emoji.)
const DRAWABLE = /^[\p{L}\p{M}\p{N}\p{P}\p{Zs}+=<>$]*$/u
function onScreen(r: Reel): string[] {
  return r.scenes.flatMap((s) => {
    switch (s.type) {
      case 'hook': return [...s.lines, s.highlight ?? '']
      case 'pov': return [s.text]
      case 'bigword': return [s.word, s.sub ?? '']
      case 'question': return [s.question, s.a, s.b]
      case 'match': return [s.name]
      case 'call': return [s.name, s.label ?? '']
      case 'chat': return [s.name, ...s.messages.map(m => m.text)]
      case 'appclip': return [s.headline, s.sub ?? '']
      case 'games': return [s.headline ?? '']
      case 'features': return [s.headline ?? '']
      case 'list': return [s.title, ...s.items]
      case 'rating': return [s.title, ...s.items.map(i => i.label)]
      case 'versus': return [s.left.label, s.left.text, s.right.label, s.right.text]
      case 'end': return [s.tagline]
    }
  }).concat(r.scenes.map(s => s.say ?? ''))
}

export function checkReel(reel: unknown): string[] {
  if (!validate(reel))
    return (validate.errors ?? []).slice(0, 12).map(e => `${e.instancePath || '/'} ${e.message}`)
  const r = reel as Reel
  const errors: string[] = []
  const first = r.scenes[0].type
  if (!['hook', 'pov', 'bigword', 'question'].includes(first))
    errors.push(`scene 1 is "${first}"; it must be hook, pov, bigword or question`)
  if (r.scenes[r.scenes.length - 1].type !== 'end')
    errors.push('the last scene must be "end"')
  if (r.scenes.slice(0, -1).some(s => s.type === 'end'))
    errors.push('"end" may only be the last scene')
  if (!r.scenes.some(s => s.say))
    errors.push('no scene has a voiceover line')
  for (let i = 1; i < r.scenes.length; i++) {
    if (r.scenes[i].type === r.scenes[i - 1].type)
      errors.push(`scenes ${i} and ${i + 1} are both "${r.scenes[i].type}"`)
  }
  r.scenes.forEach((s, i) => {
    if (s.type === 'hook' && s.highlight && !s.lines.some(l => l.toLowerCase().includes(s.highlight!.toLowerCase())))
      errors.push(`scene ${i + 1}: highlight "${s.highlight}" is not in any line`)
  })
  for (const t of onScreen(r)) {
    if (!DRAWABLE.test(t))
      errors.push(`on-screen text "${t}" has emoji or symbols; use plain words`)
  }
  const shows = r.scenes.filter(s => ['match', 'call', 'chat', 'appclip', 'games'].includes(s.type)).length
  if (!shows)
    errors.push('no scene shows the product; use at least one match, call, chat, appclip or games')
  if (r.scenes.filter(s => s.type === 'features' || s.type === 'list').length > 1)
    errors.push('use at most one features or list scene')
  if (!r.post.hashtags.some(h => h.toLowerCase() === '#randomtalker'))
    errors.push('hashtags must include #randomtalker')
  const words = r.scenes.reduce((n, s) => n + (s.say?.split(/\s+/).length ?? 0), 0)
  if (words > 75)
    errors.push(`voiceover is ${words} words; keep it under 75 (about 25 seconds)`)
  const text = JSON.stringify(r)
  for (const re of BANNED) {
    if (re.test(text))
      errors.push(`claim not allowed: ${re}`)
  }
  if (!/randomtalker\.com/i.test(r.post.caption) || !/randomtalker\.com/i.test(r.post.xText))
    errors.push('caption and xText must mention randomtalker.com')
  return errors
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let bad = 0
  for (const file of process.argv.slice(2)) {
    const errors = checkReel(JSON.parse(readFileSync(file, 'utf8')))
    console.log(errors.length ? `✗ ${file}\n  ${errors.join('\n  ')}` : `✓ ${file}`)
    bad += errors.length ? 1 : 0
  }
  process.exit(bad ? 1 : 0)
}
