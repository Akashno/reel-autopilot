// Real photos for story reels, from Wikimedia Commons (no Claude tokens). Claude writes what to
// search for (a `photo` scene's `query`); this finds a photo whose licence lets us use it
// (public domain, CC0, CC BY or CC BY-SA), and keeps who made it so the post can credit them.
//
//   npx tsx scripts/photos.ts "Christmas truce 1914"     try a search
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Photo, Reel } from '../src/types'

const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'reel-autopilot/1.0 (open-source short video renderer)'
const LICENCE_OK = /^(public domain|pd\b|pd-|cc0|cc by(-sa)? \d)/i
const strip = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(.{3,}?)\s*\1$/, '$1')
const STOP = new Set('a an the of in on at to and or for with from by photo photograph picture image old black white'.split(' '))
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
// Share of the search's words that the photo's title and description mention.
function relevance(query: string, text: string) {
  const q = words(query)
  const have = new Set(words(text))
  return q.length ? q.filter(w => have.has(w) || have.has(`${w}s`) || have.has(w.replace(/s$/, ''))).length / q.length : 0
}

async function get(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) })
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise(r => setTimeout(r, 3000 * attempt))
      continue
    }
    if (!res.ok)
      throw new Error(`Wikimedia Commons ${res.status}`)
    return res.json() as Promise<any>
  }
}

// The best usable photo for a search: Commons' own relevance order, photos only (jpeg),
// big enough for a phone screen, with a licence we can use.
export async function findPhoto(query: string): Promise<Photo | null> {
  const data = await get({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280',
  })
  const pages = Object.values<any>(data?.query?.pages ?? {}).sort((a, b) => a.index - b.index)
  let best: { photo: Photo, score: number } | undefined
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    const meta = ii?.extmetadata ?? {}
    const licence = strip(meta.LicenseShortName?.value)
    if (!ii || ii.mime !== 'image/jpeg' || ii.width < 700 || ii.height < 450 || !LICENCE_OK.test(licence))
      continue
    // Pictures of people that need their consent, or with other use limits, are skipped.
    if (strip(meta.Restrictions?.value))
      continue
    const photo: Photo = {
      query,
      title: p.title,
      url: ii.thumburl ?? ii.url,
      page: ii.descriptionurl,
      width: ii.thumbwidth ?? ii.width,
      height: ii.thumbheight ?? ii.height,
      licence,
      artist: strip(meta.Artist?.value).slice(0, 80) || 'Unknown',
      description: strip(meta.ImageDescription?.value).slice(0, 200),
    }
    // Commons' search also matches categories and file pages loosely; a photo has to be about
    // most of what was asked for. The first good match in Commons' order wins.
    const score = relevance(query, `${p.title} ${photo.description}`)
    if (score >= 0.6 && (!best || score > best.score))
      best = { photo, score }
  }
  return best?.photo ?? null
}

const queries = (r: Reel) => [...new Set(r.scenes.flatMap(s => (s.type === 'photo' ? [s.query] : [])))]

// Finds a photo for every `photo` scene; errors say which searches found nothing usable.
export async function resolvePhotos(r: Reel): Promise<{ photos: Photo[], errors: string[] }> {
  const photos: Photo[] = []
  const errors: string[] = []
  for (const q of queries(r)) {
    // A long, precise search can miss; the first three key words often find it.
    const short = words(q).slice(0, 3).join(' ')
    const p = await findPhoto(q).catch(() => null) ?? (short !== q.toLowerCase() ? await findPhoto(short).then(x => x && { ...x, query: q }).catch(() => null) : null)
    if (p)
      photos.push(p)
    else
      errors.push(`no usable photo on Wikimedia Commons for "${q}": search for something more widely photographed, or draw a prop instead`)
  }
  return { photos, errors }
}

// One credit line per photo for the post caption (CC BY and CC BY-SA require it).
export function credits(photos: Photo[]) {
  if (!photos.length)
    return ''
  return `Photos via Wikimedia Commons: ${photos.map(p => /public domain|^pd|cc0/i.test(p.licence) ? `${p.artist} (${p.licence})` : `${p.artist}, ${p.licence}`).join('; ')}`
}

// Saves each photo under public/<runDir>/ for the render; returns query -> path in public/.
export async function downloadPhotos(photos: Photo[], root: string, runDir: string) {
  const files: Record<string, string> = {}
  const dir = join(root, 'public', runDir)
  mkdirSync(dir, { recursive: true })
  for (const [i, p] of photos.entries()) {
    const file = `photo-${i}.jpg`
    if (!existsSync(join(dir, file))) {
      const res = await fetch(p.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
      if (!res.ok)
        throw new Error(`could not download ${p.title}: ${res.status}`)
      writeFileSync(join(dir, file), Buffer.from(await res.arrayBuffer()))
    }
    files[p.query] = `${runDir}/${file}`
  }
  return files
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const q of process.argv.slice(2))
    console.log(q, '->', JSON.stringify(await findPhoto(q), null, 1))
}
