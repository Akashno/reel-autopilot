// Validates a reel against reel.schema.json plus the rules a schema can't express.
//   npm run check -- brand/examples/sample.json
import { readFileSync } from 'node:fs'
import Ajv from 'ajv'
import { BRAND } from '../src/brand'
import type { Reel } from '../src/types'
import { reelSchema } from './schema'

const validate = new Ajv({ allErrors: true, strict: false }).compile(reelSchema())

// Claims the product can't back up (brand.json bannedClaims).
const BANNED = BRAND.bannedClaims.map(r => new RegExp(r, 'i'))
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Phrases that make a reel sound written by a machine or an ad agency. Viewers scroll past
// them; the writer is told to say the thing plainly instead.
export const SLOP = [
  /\bturns out\b/i, /\bgame[- ]?changer/i, /\bhere'?s the (thing|catch|kicker)/i, /\breal connections?\b/i, /\bmeaningful\b/i,
  /\bvibes?\b/i, /\benergy\b/i, /\bbutterflies\b/i, /\bunlock/i, /\belevate/i, /\bseamless/i, /\bdive (in|into)\b/i,
  /\bjourney\b/i, /\blevel up\b/i, /\bnext level\b/i, /\bin a world where\b/i, /\bsay (goodbye|hello) to\b/i,
  /\bit'?s giving\b/i, /\bmain character\b/i, /\bhits different\b/i, /\bno cap\b/i, /\blow-?key\b/i, /\bthe best part\b/i,
  /\bmagic(al)?\b/i, /\bconnect with (people|others|strangers)\b/i, /\bendless(ly)?\b/i, /\beffortless(ly)?\b/i,
  /\bready to\b/i, /\bwhat are you waiting for\b/i, /\btrust me\b/i, /\bliterally\b/i, /\bmore than just\b/i,
  /\bnot just\b.*\bbut\b/i, /\bwhether you'?re\b/i, /\bthe power of\b/i, /\bbecause sometimes\b/i, /\bwe'?ve all been there\b/i,
  /\u2014/, /\bsame thrill\b/i,
]

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
  const product = BRAND.productScenes.filter(t => BRAND.scenes.includes(t))
  if (product.length && !r.scenes.some(s => product.includes(s.type)))
    errors.push(`no scene shows the product; use at least one of: ${product.join(', ')}`)
  if (r.scenes.filter(s => s.type === 'features' || s.type === 'list').length > 1)
    errors.push('use at most one features or list scene')
  if (!r.post.hashtags.some(h => h.toLowerCase() === BRAND.hashtag.toLowerCase()))
    errors.push(`hashtags must include ${BRAND.hashtag}`)
  const count = (t?: string) => (t ? t.split(/\s+/).filter(Boolean).length : 0)
  const words = r.scenes.reduce((n, s) => n + count(s.say), 0)
  if (words > 55)
    errors.push(`voiceover is ${words} words; keep it to 25-55 so the video breathes`)
  r.scenes.forEach((s, i) => {
    if (count(s.say) > 14)
      errors.push(`scene ${i + 1}: the voice line has ${count(s.say)} words; 14 at most`)
    // Text-heavy scenes: the screen already talks, so the voice stays short.
    if (['versus', 'list', 'rating', 'features', 'question', 'chat', 'pov'].includes(s.type) && count(s.say) > 10)
      errors.push(`scene ${i + 1} (${s.type}) already has text on screen; keep its voice line to 10 words`)
  })
  // The hook must land in a glance.
  const opener = r.scenes[0]
  if (opener.type === 'hook' && count(opener.lines.join(' ')) > 7)
    errors.push(`the hook is ${count(opener.lines.join(' '))} words; 7 at most, so it reads in one glance`)
  if (opener.type === 'pov' && count(opener.text) > 12)
    errors.push('the POV opener is too long; 12 words at most')
  if (count(opener.say) > 10)
    errors.push('the first voice line is too long; 10 words at most, ideally the hook itself')
  if (r.scenes[1] && ['hook', 'pov', 'bigword'].includes(r.scenes[1].type))
    errors.push(`scene 2 is another opener (${r.scenes[1].type}); after the hook, move the story on`)
  // One stranger keeps one face.
  const faces = new Map<string, string>()
  for (const s of r.scenes) {
    if ('name' in s && 'avatar' in s) {
      const seen = faces.get(s.name.toLowerCase())
      if (seen && seen !== s.avatar)
        errors.push(`"${s.name}" appears with two different avatars (${seen}, ${s.avatar}); one person, one avatar`)
      faces.set(s.name.toLowerCase(), s.avatar)
    }
  }
  const spoken = [...onScreen(r), r.post.caption, r.post.xText, r.post.youtubeTitle].join('\n')
  for (const re of SLOP) {
    const m = spoken.match(re)
    if (m)
      errors.push(`"${m[0]}" sounds generic or machine-written; say it plainly in your own words`)
  }
  const text = JSON.stringify(r)
  for (const re of BANNED) {
    if (re.test(text))
      errors.push(`claim not allowed: ${re}`)
  }
  const site = new RegExp(escape(BRAND.site), 'i')
  if (!site.test(r.post.caption) || !site.test(r.post.xText))
    errors.push(`caption and xText must mention ${BRAND.site}`)
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
