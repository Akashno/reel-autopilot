// Two full-reel formats built for sharing rather than selling:
//
// - `thread`: a whole chat between two strangers, message by message, with typing dots, a ping
//   on every message and a twist in the last one. The hook stays pinned above the chat from the
//   first frame, so there is never a blank opening.
// - `cards`: "types of people" style cards that swipe in one by one under a pinned title, ending
//   on a "send this to..." nudge. Made to be forwarded to a friend.
import type { ReactNode } from 'react'
import { Audio, Sequence, staticFile } from 'remotion'
import type { Scene } from '../types'
import { BOX, C, DISPLAY, Dot, ease, Face, fitSize, FPS, H, Headline, Icon, mix, Pop, Stage, THEME, useScene, useSpring, useT, useWordAt, withMarker } from '../ui'

type Of<T extends Scene['type']> = Extract<Scene, { type: T }>
type Msg = Of<'thread'>['messages'][number]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const TYPING = 0.5 // typing dots shown this long before each of their messages

// When each message lands (seconds into the scene) and when the scene can end: enough time
// to read the previous message, typing dots before theirs, an extra pause on a `beat`.
export function threadTimes(messages: Msg[]) {
  const at: number[] = []
  let t = 0
  messages.forEach((m, i) => {
    if (i > 0) {
      const prev = messages[i - 1].text.length
      t += clamp(0.45 + prev * 0.045, 0.85, 2.6) + (m.beat ? 1.1 : 0) + (m.from === 'them' ? TYPING * 0.6 : 0)
    }
    at.push(t)
  })
  const last = messages.at(-1)?.text.length ?? 0
  return { at, end: t + clamp(1 + last * 0.06, 1.8, 3.6) }
}

function Sfx({ at, src, volume }: { at: number, src: string, volume: number }) {
  return (
    <Sequence from={Math.max(0, Math.round(at * FPS))} durationInFrames={Math.round(0.6 * FPS)} layout="none">
      <Audio src={staticFile(src)} volume={volume} />
    </Sequence>
  )
}

function Typing() {
  const t = useT()
  return (
    <div style={{ display: 'flex', gap: 12, padding: '26px 34px', borderRadius: 40, borderBottomLeftRadius: 10, background: THEME.bg === C.bg ? '#EFEAF7' : THEME.panel, boxShadow: `0 0 0 2px ${THEME.line}` }}>
      {[0, 1, 2].map(i => <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: THEME.text, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(t * 9 - i * 0.9)) }} />)}
    </div>
  )
}

// One message: it opens its own space (so the older ones slide up smoothly), then pops in.
function Arrive({ at, me, children }: { at: number, me: boolean, children: ReactNode }) {
  const t = useT()
  // The first message is already there on frame 0.
  const grow = at <= 0 ? 1 : ease(t, at, 0.2)
  return (
    <div style={{ maxHeight: grow * 420, display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', paddingTop: 18 * grow }}>
      {at <= 0 ? children : <Pop at={at} rise={30} from={0.7} style={{ transformOrigin: me ? 'right bottom' : 'left bottom' }}>{children}</Pop>}
    </div>
  )
}

export function Thread({ s }: { s: Of<'thread'> }) {
  const t = useT()
  const { at } = threadTimes(s.messages)
  const n = s.messages.length
  const twist = at[n - 1]
  const shake = t > twist && t < twist + 0.45 ? Math.sin((t - twist) * 60) * 10 * (1 - (t - twist) / 0.45) : 0
  const glow = ease(t, twist, 0.3)
  const typingFor = s.messages.findIndex((m, i) => i > 0 && m.from === 'them' && t >= at[i] - TYPING && t < at[i])
  const hookSize = s.hook.length > 34 ? 66 : s.hook.length > 22 ? 78 : 92
  const top = BOX.top + 10
  const panelTop = top + (s.hook.length > 22 ? 250 : 190)
  return (
    <Stage>
      <div style={{ position: 'absolute', left: BOX.left - 20, right: BOX.right - 20, top, display: 'flex', justifyContent: 'center' }}>
        <Headline size={hookSize} style={{ lineHeight: 1.12 }}>{withMarker(s.hook, s.highlight, 0.2)}</Headline>
      </div>
      <div style={{ position: 'absolute', left: BOX.left, right: BOX.right, top: panelTop, bottom: H - 1460, borderRadius: 48, background: THEME.bg === C.bg ? 'rgba(255,253,247,0.9)' : 'rgba(20,20,26,0.82)', boxShadow: `0 0 0 2px ${THEME.line}, 0 40px 90px ${THEME.shadow}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', transform: `translateX(${shake}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '26px 32px', borderBottom: `2px solid ${THEME.line}`, flexShrink: 0 }}>
          <Face avatar={s.avatar} size={84} />
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, letterSpacing: -1 }}>{s.name}</div>
            <div style={{ fontSize: 30, fontWeight: 600, color: THEME.ok }}><Dot color={THEME.ok} size={12} />Stranger on Random Talker</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 28px 30px', overflow: 'hidden' }}>
          {s.messages.map((m, i) => t >= at[i] - 0.02 && (
            <Arrive key={i} at={at[i]} me={m.from === 'me'}>
              <div style={{ maxWidth: 660, padding: '22px 32px', borderRadius: 40, [m.from === 'me' ? 'borderBottomRightRadius' : 'borderBottomLeftRadius']: 10, background: m.from === 'me' ? C.gold : THEME.bg === C.bg ? '#EFEAF7' : THEME.panel, color: m.from === 'me' ? C.ink : THEME.text, fontSize: 46, fontWeight: 600, lineHeight: 1.25, boxShadow: i === n - 1 ? `0 0 0 ${6 * glow}px ${C.gold}, 0 0 ${70 * glow}px ${C.gold}88` : `0 0 0 2px ${m.from === 'me' ? 'transparent' : THEME.line}`, transform: `scale(${i === n - 1 ? mix(1, 1.06, glow) : 1})`, transformOrigin: m.from === 'me' ? 'right center' : 'left center' }}>
                {m.text}
              </div>
            </Arrive>
          ))}
          {typingFor >= 0 && <Arrive at={at[typingFor] - TYPING} me={false}><Typing /></Arrive>}
        </div>
      </div>
      {s.messages.map((m, i) => <Sfx key={i} at={at[i]} src={m.from === 'me' ? 'sfx/sent.mp3' : 'sfx/ping.mp3'} volume={0.35} />)}
      <Sfx at={twist + 0.02} src="sfx/thud.mp3" volume={0.5} />
    </Stage>
  )
}

// ---- cards -------------------------------------------------------------------------------

type Item = Of<'cards'>['items'][number]
const cardSecs = (it: Item) => clamp(1.1 + (it.title.length + (it.line?.length ?? 0)) * 0.03, 1.8, 3.2)
const CTA_SECS = 2.2

// Stepped times used when there is no voice line to follow.
export function cardTimes(items: Item[]) {
  const at: number[] = []
  let t = 0.35
  for (const it of items) {
    at.push(t)
    t += cardSecs(it)
  }
  return { at, cta: t, end: t + CTA_SECS }
}

export function Cards({ s }: { s: Of<'cards'> }) {
  const t = useT()
  const { secs } = useScene()
  const base = cardTimes(s.items)
  const at = s.items.map((it, i) => useWordAt(it.on, base.at[i]))
  const ctaAt = Math.min(Math.max(base.cta, at[at.length - 1] + 1.6), secs - CTA_SECS + 0.4)
  const n = s.items.length
  const current = at.reduce((c, a, i) => (t >= a ? i : c), 0)
  const titleSize = fitSize([s.title], 100, 66)
  const ins = at.map(a => useSpring(a, { damping: 14, mass: 0.9, stiffness: 140 }))
  const cta = useSpring(ctaAt, { damping: 10, mass: 0.8, stiffness: 150 })
  return (
    <Stage>
      <div style={{ position: 'absolute', left: BOX.left - 20, right: BOX.right - 20, top: BOX.top + 10, display: 'flex', justifyContent: 'center' }}>
        <Headline size={titleSize} style={{ lineHeight: 1.1 }}>{s.title}</Headline>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 470, height: 800, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {/* the rest of the deck, peeking out behind */}
        {[2, 1].map(k => current + k < n && (
          <div key={k} style={{ position: 'absolute', width: 860, height: 720, borderRadius: 52, background: C.tints[(current + k) % C.tints.length], opacity: 0.35 / k, transform: `translateY(${k * 34}px) scale(${1 - k * 0.05}) rotate(${k % 2 ? 3 : -3}deg)` }} />
        ))}
        {s.items.map((it, i) => {
          if (i < current - 1 || i > current)
            return null
          const inP = ins[i]
          const out = i < n - 1 ? ease(t, at[i + 1] - 0.05, 0.35) : 0
          const x = mix(900, 0, inP) - out * 1200
          const rot = mix(14, 0, inP) - out * 20
          return (
            <div key={i} style={{ position: 'absolute', width: 860, height: 720, borderRadius: 52, background: C.tints[i % C.tints.length], color: C.ink, boxShadow: `0 0 0 2px ${THEME.line}, 0 40px 90px ${THEME.shadow}`, padding: '70px 56px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30, transform: `translateX(${x}px) rotate(${rot}deg)` }}>
              <div style={{ position: 'absolute', top: 36, left: 44, padding: '8px 24px', borderRadius: 999, background: C.ink, color: '#FFF', fontFamily: DISPLAY, fontWeight: 800, fontSize: 40 }}>{i + 1}/{n}</div>
              {it.avatar && <div style={{ alignSelf: 'center' }}><Face avatar={it.avatar} size={190} /></div>}
              <Headline size={fitSize([it.title], 118, 70, 740)} style={{ lineHeight: 1.05 }}>{it.title}</Headline>
              {it.line && <div style={{ fontSize: 54, fontWeight: 600, lineHeight: 1.22, textAlign: 'center', color: '#3E3B48' }}>{it.line}</div>}
            </div>
          )
        })}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1320, display: 'flex', justifyContent: 'center' }}>
        <div style={{ opacity: Math.min(1, cta * 2), transform: `scale(${mix(0.5, 1, cta) * (1 + 0.03 * Math.sin(Math.max(0, t - ctaAt) * 6))})`, display: 'flex', alignItems: 'center', gap: 18, padding: '24px 44px', borderRadius: 999, background: C.gold, color: C.ink, fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize([s.cta], 60, 40, 700), boxShadow: `0 0 60px ${C.gold}66` }}>
          <Icon name="send" size={50} color={C.ink} />{s.cta}
        </div>
      </div>
      {at.map((a, i) => <Sfx key={i} at={a} src={i % 2 ? 'sfx/swipe.mp3' : 'sfx/swoosh.mp3'} volume={0.3} />)}
      <Sfx at={ctaAt} src="sfx/sent.mp3" volume={0.4} />
    </Stage>
  )
}

export const cardsMinSecs = (s: Of<'cards'>) => cardTimes(s.items).end
