import type { CSSProperties, ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { AbsoluteFill, cancelRender, continueRender, delayRender, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { asset, BRAND } from './brand'

// Colours and fonts come from brand/brand.json.
export const C = BRAND.colors
export const DISPLAY = `"${BRAND.fonts.display}", sans-serif`
export const BODY = `"${BRAND.fonts.body}", ui-sans-serif, system-ui, sans-serif`
export const W = 1080
export const H = 1920
export const FPS = 30
// Where Instagram, Facebook and YouTube draw their own UI over a 1080x1920 reel (the union
// of the three): a header band at the top, caption/username/audio at the bottom, and the
// like/comment/share rail on the right from about mid-height down. Content stays out of
// these, but should otherwise use the space: don't shrink everything to a postage stamp.
export const SAFE = { top: 220, bottom: 1480, side: 60, rail: { x: 960, y: 900 } }

// The content column every scene lays out in: 840 wide, centred, clear of the right rail,
// and vertically centred between the header band and the captions (or the bottom band).
export const BOX = { left: 120, right: 120, top: 250, bottom: 1450, captionTop: 1300 }
// Scenes with little text of their own get burned-in captions; the rest already show the words.
export const CAPTIONED = ['match', 'call'] as const

export function Column({ children, captions = false, gap = 44, align = 'center', style }: { children: ReactNode, captions?: boolean, gap?: number, align?: CSSProperties['alignItems'], style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: BOX.left, right: BOX.right, top: BOX.top, bottom: H - (captions ? BOX.captionTop - 30 : BOX.bottom), display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: align, gap, ...style }}>
      {children}
    </div>
  )
}

// Debug overlay of those zones (stills.ts draws it; never in a real render).
export function Guides() {
  const z = 'rgba(239,68,68,0.28)'
  const box = (style: CSSProperties) => <div style={{ position: 'absolute', background: z, outline: '3px dashed rgba(200,0,0,0.7)', ...style }} />
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {box({ left: 0, right: 0, top: 0, height: SAFE.top })}
      {box({ left: 0, right: 0, top: SAFE.bottom, bottom: 0 })}
      {box({ left: SAFE.rail.x, right: 0, top: SAFE.rail.y, height: SAFE.bottom - SAFE.rail.y })}
      {box({ left: 0, width: SAFE.side, top: SAFE.top, height: SAFE.bottom - SAFE.top, background: 'rgba(239,68,68,0.12)' })}
      {box({ right: 0, width: SAFE.side, top: SAFE.top, height: SAFE.rail.y - SAFE.top, background: 'rgba(239,68,68,0.12)' })}
    </AbsoluteFill>
  )
}

// Holds rendering until the brand fonts have loaded.
export function useFonts() {
  const [handle] = useState(() => delayRender('Loading fonts'))
  useEffect(() => {
    Promise.all(BRAND.fonts.files.map(f => new FontFace(f.family, `url(${staticFile(asset(f.file))})`, { weight: String(f.weight) }).load().then(face => document.fonts.add(face))))
      .then(() => continueRender(handle))
      .catch(err => cancelRender(err))
  }, [handle])
}

// ---- time --------------------------------------------------------------------------------

// Each scene knows how long it runs, so timed steps (chat bubbles, list items) spread over it.
export const SceneCtx = createContext({ secs: 4, index: 0 })
export const useScene = () => useContext(SceneCtx)
export const useT = () => useCurrentFrame() / FPS

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
export const ease = (t: number, start: number, dur: number) => interpolate(t, [start, start + dur], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) })
export const mix = (a: number, b: number, p: number) => a + (b - a) * p

export function useSpring(at: number, config = { damping: 15, mass: 0.9, stiffness: 130 }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - Math.round(at * FPS), fps, config })
}

// Spread n steps over the scene, leaving `lead` seconds before the first and `tail` after the last.
export function stepTimes(n: number, secs: number, lead = 0.25, tail = 0.9) {
  const span = Math.max(0.6, secs - lead - tail)
  const gap = Math.min(1.1, span / Math.max(1, n))
  return Array.from({ length: n }, (_, i) => lead + i * gap)
}

// ---- layout ------------------------------------------------------------------------------

export function Dot({ color = C.green, size = 18 }: { color?: string, size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, marginRight: size * 0.6, verticalAlign: 'middle', position: 'relative', top: -size * 0.12 }} />
}
// Cream page with the sun glow. Nothing else: the scene's content is the only thing to look at.
export function Stage({ children, tint }: { children: ReactNode, seed?: number, tint?: string }) {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(130% 55% at 50% 0%, ${tint ?? C.sun} 0%, ${C.glow} 38%, ${C.bg} 72%)`, color: C.ink, fontFamily: BODY, overflow: 'hidden' }}>
      {children}
    </AbsoluteFill>
  )
}

export const center: CSSProperties = { position: 'absolute', left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }

// Springs in from `at` seconds: scale + fade + a small rise.
export function Pop({ at, children, style, from = 0.6, rise = 40 }: { at: number, children: ReactNode, style?: CSSProperties, from?: number, rise?: number }) {
  const s = useSpring(at)
  return (
    <div style={{ opacity: Math.min(1, s * 1.6), transform: `translateY(${(1 - s) * rise}px) scale(${mix(from, 1, s)})`, ...style }}>
      {children}
    </div>
  )
}

export function Headline({ children, size = 112, style }: { children: ReactNode, size?: number, style?: CSSProperties }) {
  return <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.05, letterSpacing: -size * 0.035, textAlign: 'center', ...style }}>{children}</div>
}

// Headline size that keeps the longest line on one row in the content column.
export function fitSize(lines: string[], max = 150, min = 72, width = 840) {
  const longest = Math.max(...lines.map(l => l.length), 1)
  return Math.round(Math.max(min, Math.min(max, width / (longest * 0.6))))
}

// Gold marker swept under a phrase from `at` seconds.
export function Marker({ at, children }: { at: number, children: ReactNode }) {
  const p = ease(useT(), at, 0.5)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ position: 'absolute', left: -10, right: -10, bottom: '0.06em', height: '0.38em', background: C.gold, borderRadius: 12, transformOrigin: 'left', transform: `scaleX(${p})` }} />
      <span style={{ position: 'relative' }}>{children}</span>
    </span>
  )
}

// Renders `text` with `highlight` (if it occurs) under a gold marker.
export function withMarker(text: string, highlight: string | undefined, at: number) {
  const i = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1
  if (!highlight || i < 0)
    return text
  return <>{text.slice(0, i)}<Marker at={at}>{text.slice(i, i + highlight.length)}</Marker>{text.slice(i + highlight.length)}</>
}

export function Card({ children, style }: { children: ReactNode, style?: CSSProperties }) {
  return <div style={{ background: C.card, borderRadius: 44, boxShadow: '0 0 0 2px rgba(80,60,0,0.06), 0 30px 60px rgba(120,90,0,0.16), 0 8px 20px rgba(120,90,0,0.08)', ...style }}>{children}</div>
}

export function Chip({ children, dark, style }: { children: ReactNode, dark?: boolean, style?: CSSProperties }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 30px', borderRadius: 999, background: dark ? C.ink : C.card, color: dark ? '#FFF' : C.ink, fontSize: 40, fontWeight: 600, boxShadow: '0 0 0 2px rgba(17,17,16,0.06), 0 10px 24px rgba(120,90,0,0.12)', ...style }}>{children}</div>
}

export function Bubble({ text, me, size = 52, style }: { text: string, me?: boolean, size?: number, style?: CSSProperties }) {
  return (
    <div style={{ maxWidth: 700, padding: `${size * 0.48}px ${size * 0.72}px`, borderRadius: size * 0.9, [me ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: size * 0.22, background: me ? C.ink : '#FFF', color: me ? '#FFF' : C.ink, fontSize: size, fontWeight: 600, lineHeight: 1.25, boxShadow: me ? '0 12px 30px rgba(0,0,0,0.18)' : '0 0 0 2px rgba(17,17,16,0.05), 0 12px 30px rgba(120,90,0,0.14)', ...style }}>
      {text}
    </div>
  )
}

export function Face({ avatar, size }: { avatar: string, size: number }) {
  const a = BRAND.avatars[avatar]
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: a?.tint ?? C.tints[0], overflow: 'hidden', boxShadow: `0 0 0 ${Math.max(4, size * 0.03)}px #FFF, 0 24px 50px rgba(120,90,0,0.22)` }}>
      {a && <Img src={staticFile(asset(a.file))} style={{ width: '100%', height: '100%' }} />}
    </div>
  )
}

// The brand mark, as an app-icon tile.
export function Logo({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.24, overflow: 'hidden', boxShadow: '0 40px 80px rgba(120,90,0,0.28), 0 10px 24px rgba(120,90,0,0.18)' }}>
      <Img src={staticFile(asset(BRAND.logo))} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

// Live-looking voice waveform.
export function Wave({ bars = 17, height = 120, color = C.ink, active = 1 }: { bars?: number, height?: number, color?: string, active?: number }) {
  const t = useT()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, height }}>
      {Array.from({ length: bars }, (_, i) => {
        const env = Math.sin((i / (bars - 1)) * Math.PI)
        const v = 0.25 + 0.75 * Math.abs(Math.sin(t * 7 + i * 1.7) * Math.sin(t * 3.1 + i * 0.6))
        return <div key={i} style={{ width: 14, height: Math.max(14, height * env * mix(0.15, v, active)), borderRadius: 8, background: color }} />
      })}
    </div>
  )
}

// ---- icons (Lucide, ISC) -----------------------------------------------------------------

const ICONS: Record<string, string> = {
  // Lucide icons available to brand.json features. Add more from lucide.dev (ISC licence).
  'mic': '<path d="M12 19v3m7-12v2a7 7 0 0 1-14 0v-2"/><rect width="6" height="13" x="9" y="2" rx="3"/>',
  'mic-off': '<path d="M12 19v3m3-12.66V5a3 3 0 0 0-5.68-1.33M16.95 16.95A7 7 0 0 1 5 12v-2m13.89 3.23A7 7 0 0 0 19 12v-2M2 2l20 20M9 9v3a3 3 0 0 0 5.12 2.12"/>',
  'phone': '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233a14 14 0 0 0 6.392 6.384"/>',
  'phone-off': '<path d="M10.1 13.9a14 14 0 0 0 3.732 2.668a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 4.1 15.4M22 2L2 22M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233a14 14 0 0 0 .244.473"/>',
  'video-off': '<path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2M2 2l20 20"/>',
  'user-round-x': '<path d="M2 21a8 8 0 0 1 11.873-7"/><circle cx="10" cy="8" r="5"/><path d="m17 17l5 5m0-5l-5 5"/>',
  'download': '<path d="M12 15V3m9 12v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10l5 5l5-5"/>',
  'zap': '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  'gamepad': '<path d="M6 11h4M8 9v4m7-1h.01M18 10h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59l-.006.052c-.049.41-.304 2.548-.304 3.142C2.392 15.5 4 17 6 17c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 10.828 14h2.344a2 2 0 0 1 1.414.586L16 16c.5.5 1 1 2 1c2 0 3.608-1.5 3.608-5.216c0-.594-.255-2.732-.304-3.142l-.006-.052A4 4 0 0 0 17.32 5"/>',
  'skip-forward': '<path d="M21 4v16M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>',
  'flag': '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>',
  'hash': '<path d="M4 9h16M4 15h16M10 3L8 21m8-18l-2 18"/>',
  'message-circle': '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092a10 10 0 1 0-4.777-4.719"/>',
  'languages': '<path d="m5 8l6 6m-7 0l6-6l2-3M2 5h12M7 2h1m14 20l-5-10l-5 10m2-4h6"/>',
  'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/>',
  'venetian-mask': '<path d="M18 11c-1.5 0-2.5.5-3 2M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5a8 8 0 0 1 5 2a8 8 0 0 1 5-2a5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2a8 8 0 0 0-5-2zm2 5c1.5 0 2.5.5 3 2"/>',
  'heart-handshake': '<path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676a.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052zm-9.414-5L8 11.5a2.5 2.5 0 1 0 3.5 3.5l1.5-1.5m1 3.5l2-2m-4.5-.5l2-2"/>',
  'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/>',
}

export function Icon({ name, size, color = 'currentColor', fill }: { name: string, size: number, color?: string, fill?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ?? 'none'} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
}

// Every feature the reel may mention, with its icon (a name from ICONS) and on-screen wording.
export const FEATURES = BRAND.features

// ---- phone -------------------------------------------------------------------------------

// Plain phone frame; children fill the screen (390 x 844 points, drawn at `width`).
export function PhoneFrame({ width, children, style }: { width: number, children: ReactNode, style?: CSSProperties }) {
  const bezel = width * 0.035
  const h = width * (1688 / 780)
  return (
    <div style={{ width: width + bezel * 2, height: h + bezel * 2, padding: bezel, borderRadius: width * 0.15, background: C.ink, boxShadow: '0 50px 100px rgba(80,60,0,0.30), 0 14px 30px rgba(80,60,0,0.18)', ...style }}>
      <div style={{ position: 'relative', width, height: h, borderRadius: width * 0.12, overflow: 'hidden', background: C.bg }}>
        {children}
      </div>
    </div>
  )
}
