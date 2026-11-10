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
      case 'prop': return [s.text ?? '']
      case 'people': return [...s.people.map(p => p.label), s.text ?? '']
      case 'count': return s.items.flatMap(i => [i.value, i.label])
      case 'end': return [s.tagline]
    }
  }).concat(r.scenes.map(s => s.say ?? ''))
}

// A story's first line opens on the strange fact itself, never on scene-setting (from Untold Files).
const HOOK_SLOW = /^(in|on|back in|during|once|one day|years ago|long ago|there (was|were|is)|it (was|is)|this is|meet|so|imagine|ever)\b/i
const YEAR_WORDS = /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[ -](hundred|oh|o'|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b|\btwo thousand\b|\b1[0-9]{3}\b|\b20[0-9]{2}\b/i

// Props are SVG drawn by Claude (from Untold Files). The renderer only draws them as images, so
// nothing in them can run, but anything that isn't plain shapes is refused anyway, every prop
// must be used, and every prop a scene names must exist.
const SVG_BAD = /<\s*(script|foreignObject|image|img|iframe|style|text|a|use|filter|animate|set)\b|\bon[a-z]+\s*=|\b(?:xlink:)?href\s*=|url\(\s*['"]?(?!#)|javascript:|@import|<!/i
function checkProps(r: Reel): string[] {
  const errors: string[] = []
  const props = r.props ?? []
  const names = new Set(props.map(p => p.name))
  for (const p of props) {
    const svg = p.svg.trim()
    if (!/^<svg\b[^>]*viewBox="0 0 400 400"/.test(svg) || !svg.endsWith('</svg>'))
      errors.push(`prop "${p.name}": must be one <svg viewBox="0 0 400 400">...</svg>`)
    const bad = svg.match(SVG_BAD)
    if (bad)
      errors.push(`prop "${p.name}": "${bad[0]}" is not allowed; use plain shapes only`)
    const opens = (svg.match(/<[a-zA-Z][^>]*[^/]>|<[a-zA-Z]>/g) ?? []).length
    const closes = (svg.match(/<\/[a-zA-Z]+\s*>/g) ?? []).length
    if (opens !== closes)
      errors.push(`prop "${p.name}": the SVG tags don't balance (${opens} open, ${closes} closed)`)
  }
  const used = new Set<string>()
  r.scenes.forEach((s, i) => {
    const refs = s.type === 'prop' ? [s.prop] : s.type === 'people' ? [s.item, ...s.people.map(p => p.prop)] : []
    for (const ref of refs) {
      if (!ref)
        continue
      used.add(ref)
      if (!names.has(ref))
        errors.push(`scene ${i + 1}: "${ref}" is not one of your props`)
    }
    if (s.type === 'people' && s.people.some(p => !p.avatar === !p.prop))
      errors.push(`scene ${i + 1}: give each person either an avatar or a prop, not both or neither`)
  })
  for (const n of names) {
    if (!used.has(n))
      errors.push(`prop "${n}" is never shown; use it in a scene or drop it`)
  }
  return errors
}

// Every `on` word must be in that scene's voice line, or the timing has nothing to follow.
function checkCues(r: Reel): string[] {
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '')
  const errors: string[] = []
  r.scenes.forEach((s, i) => {
    const said = (s.say ?? '').split(/\s+/).map(norm)
    const cues = s.type === 'prop' || s.type === 'people'
      ? [s.type === 'prop' ? s.on : undefined, s.textOn, ...(s.type === 'people' ? s.people.map(p => p.on) : [])]
      : s.type === 'count' ? s.items.map(x => x.on) : []
    for (const cue of cues) {
      const w = cue && norm(cue.split(/\s+/)[0])
      if (w && !said.some(x => x.startsWith(w)))
        errors.push(`scene ${i + 1}: "${cue}" is not a word in its voice line`)
    }
  })
  return errors
}

export function checkReel(reel: unknown): string[] {
  if (!validate(reel))
    return (validate.errors ?? []).slice(0, 12).map(e => `${e.instancePath || '/'} ${e.message}`)
  const r = reel as Reel
  const errors: string[] = []
  const story = r.idea.format === 'story'
  const n = r.scenes.length
  if (story ? n < 6 || n > 9 : n > 7)
    errors.push(`${n} scenes; ${story ? 'a story uses 6-9' : 'a skit uses 5-7'} including the end`)
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
  errors.push(...checkProps(r), ...checkCues(r))
  if (story && !r.scenes.some(s => s.type === 'prop' || (s.type === 'people' && (s.item || s.people.some(p => p.prop)))))
    errors.push('a story must SHOW its own objects: draw 1-3 props and use them in prop or people scenes')
  if (story && r.scenes.filter(s => ['prop', 'people', 'count'].includes(s.type)).length < 2)
    errors.push('use at least 2 picture scenes (prop, people, count) so the viewer sees the story')
  const product = BRAND.productScenes.filter(t => BRAND.scenes.includes(t))
  if (story) {
    // The story is the video; the product only closes it (the last two scenes before the end card).
    r.scenes.forEach((s, i) => {
      // A chat can be the story's own messages (a wrong-number text), so it may appear anywhere.
      if (product.includes(s.type) && s.type !== 'chat' && i < n - 3)
        errors.push(`scene ${i + 1} (${s.type}) shows the product mid-story; in a story the product only appears in the last two scenes before the end`)
    })
  }
  else if (product.length && !r.scenes.some(s => product.includes(s.type))) {
    errors.push(`no scene shows the product; use at least one of: ${product.join(', ')}`)
  }
  if (r.scenes.filter(s => s.type === 'features' || s.type === 'list').length > 1)
    errors.push('use at most one features or list scene')
  if (!r.post.hashtags.some(h => h.toLowerCase() === BRAND.hashtag.toLowerCase()))
    errors.push(`hashtags must include ${BRAND.hashtag}`)
  const count = (t?: string) => (t ? t.split(/\s+/).filter(Boolean).length : 0)
  const words = r.scenes.reduce((n, s) => n + count(s.say), 0)
  if (story && (words < 50 || words > 85))
    errors.push(`the story is ${words} words; tell it in 55-80 so it flows but still moves`)
  if (!story && words > 55)
    errors.push(`voiceover is ${words} words; keep it to 25-55 so the video breathes`)
  const maxSay = story ? 18 : 14, maxBusy = story ? 14 : 10
  r.scenes.forEach((s, i) => {
    if (story && !s.say)
      errors.push(`scene ${i + 1} has no voice line; in a story every scene carries the next part of it`)
    if (count(s.say) > maxSay)
      errors.push(`scene ${i + 1}: the voice line has ${count(s.say)} words; ${maxSay} at most`)
    // Text-heavy scenes: the screen already talks, so the voice stays short.
    if (['versus', 'list', 'rating', 'features', 'question', 'chat', 'pov'].includes(s.type) && count(s.say) > maxBusy)
      errors.push(`scene ${i + 1} (${s.type}) already has text on screen; keep its voice line to ${maxBusy} words`)
  })
  // The hook must land in a glance.
  const opener = r.scenes[0]
  if (opener.type === 'hook' && count(opener.lines.join(' ')) > 7)
    errors.push(`the hook is ${count(opener.lines.join(' '))} words; 7 at most, so it reads in one glance`)
  if (opener.type === 'pov' && count(opener.text) > 12)
    errors.push('the POV opener is too long; 12 words at most')
  if (count(opener.say) > (story ? 16 : 10))
    errors.push(`the first voice line is too long; ${story ? 16 : 10} words at most, ideally the hook itself`)
  if (story && opener.say && (HOOK_SLOW.test(opener.say.trim()) || YEAR_WORDS.test(opener.say)))
    errors.push(`the first voice line starts slow ("${opener.say.split(/\s+/).slice(0, 4).join(' ')}..."): open with the strange fact itself, and give the year or place in scene 2`)
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
