import { Img, OffthreadVideo, staticFile } from 'remotion'
import type { Scene } from '../types'
import { asset, BRAND } from '../brand'
import { Bubble, C, Card, Chip, Column, Dot, ease, Face, FEATURES, fitSize, FPS, Headline, Icon, mix, Logo, PhoneFrame, Pop, DISPLAY, Stage, stepTimes, useScene, useSpring, useT, Wave } from '../ui'

type Of<T extends Scene['type']> = Extract<Scene, { type: T }>

const timer = (s: number) => `00:${String(Math.floor(Math.max(0, s))).padStart(2, '0')}`

function CallButtons() {
  const btn = (icon: string, bg: string, color: string, size: number) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(17,17,16,0.06), 0 12px 26px rgba(120,90,0,0.16)' }}>
      <Icon name={icon} size={size * 0.42} color={color} />
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 56 }}>
      {btn('mic', '#FFF', C.ink, 120)}
      {btn('phone-off', C.red, '#FFF', 160)}
      {btn('message-circle', '#FFF', C.ink, 120)}
    </div>
  )
}

function NameStatus({ name, status, size = 84 }: { name: string, status: string, size?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: size, letterSpacing: -2, lineHeight: 1.05 }}>{name}</div>
      <div style={{ fontSize: 42, fontWeight: 600, color: C.green }}><Dot />{status}</div>
    </div>
  )
}

// Searching rings, then the stranger pops in: "You are connected to <name>".
export function Match({ s }: { s: Of<'match'> }) {
  const t = useT()
  const found = 1.3
  const card = useSpring(found, { damping: 11, mass: 0.8, stiffness: 140 })
  const searching = 1 - ease(t, found - 0.15, 0.2)
  return (
    <Stage>
      <Column captions gap={48}>
        <Pop at={found + 0.15}>
          <Chip style={{ background: C.callGreen, color: '#FFF', fontSize: 40 }}><Icon name="phone" size={40} color="#FFF" />Connected</Chip>
        </Pop>
        <div style={{ position: 'relative', width: 420, height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {[0, 1, 2].map(i => {
            const p = ((t + i * 0.45) % 1.35) / 1.35
            return <div key={i} style={{ position: 'absolute', width: mix(200, 760, p), height: mix(200, 760, p), borderRadius: '50%', border: `6px solid ${C.ink}`, opacity: (1 - p) * 0.35 * searching }} />
          })}
          <div style={{ position: 'absolute', opacity: searching, fontFamily: DISPLAY, fontWeight: 800, fontSize: 64 }}>Matching{'.'.repeat(1 + Math.floor(t * 3) % 3)}</div>
          <div style={{ position: 'absolute', transform: `scale(${card}) rotate(${(1 - card) * 10}deg)`, opacity: Math.min(1, card * 2) }}>
            <Face avatar={s.avatar} size={420} />
          </div>
        </div>
        <Pop at={found + 0.3}>
          <NameStatus name={s.name} status={`Connected · ${timer(t - found)}`} size={fitSize([s.name], 92, 64)} />
        </Pop>
      </Column>
    </Stage>
  )
}

// On a voice call: face, live waveform, timer and call buttons.
export function Call({ s }: { s: Of<'call'> }) {
  const { index } = useScene()
  const t = useT()
  const start = 37 + (index * 13) % 50
  return (
    <Stage tint="#F3E3B0">
      <Column captions gap={40}>
        {s.label && <Pop at={0.05}><Chip dark style={{ fontSize: 42 }}>{s.label}</Chip></Pop>}
        <Pop at={0.1}><Face avatar={s.avatar} size={s.label ? 300 : 340} /></Pop>
        <Pop at={0.25}>
          <NameStatus name={s.name} status={`Connected · 0${Math.floor((start + t) / 60)}:${String(Math.floor(start + t) % 60).padStart(2, '0')}`} size={fitSize([s.name], 88, 64)} />
        </Pop>
        <Pop at={0.35}><Wave height={110} bars={19} /></Pop>
        <Pop at={0.45}><CallButtons /></Pop>
      </Column>
    </Stage>
  )
}

// Text chat: header with the stranger, bubbles one by one. Every bubble takes its place
// from the start (invisible until it pops), so nothing shifts as they arrive.
export function Chat({ s }: { s: Of<'chat'> }) {
  const { secs } = useScene()
  const at = stepTimes(s.messages.length, secs, 0.5)
  return (
    <Stage>
      <Column align="stretch" gap={26}>
        <Pop at={0.05} style={{ marginBottom: 24 }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '24px 32px', borderRadius: 36 }}>
            <Face avatar={s.avatar} size={100} />
            <div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52 }}>{s.name}</div>
              <div style={{ fontSize: 36, fontWeight: 600, color: C.green }}><Dot size={14} />Connected</div>
            </div>
          </Card>
        </Pop>
        {s.messages.map((m, i) => (
          <Pop key={i} at={at[i]} rise={40} from={0.8} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', transformOrigin: m.from === 'me' ? 'right bottom' : 'left bottom' }}>
            <Bubble text={m.text} me={m.from === 'me'} size={52} />
          </Pop>
        ))}
      </Column>
    </Stage>
  )
}

// Real screen recordings (brand.json clips): `from`-`to` is the part worth playing.
export function AppClip({ s }: { s: Of<'appclip'> }) {
  const { secs } = useScene()
  const c = BRAND.clips[s.clip]
  // Fit the interesting part into the scene, never running past the end of the file.
  const rate = Math.min(3, Math.max(0.7, (c.to - c.from) / secs), (c.length - 0.2 - c.from) / secs)
  const phone = useSpring(0.1, { damping: 16, mass: 1, stiffness: 110 })
  return (
    <Stage>
      <Column gap={44}>
        <Pop at={0.05}>
          <Headline size={fitSize([s.headline], 96, 66)}>{s.headline}</Headline>
          {s.sub && <div style={{ marginTop: 14, fontSize: 44, fontWeight: 600, color: C.muted, textAlign: 'center' }}>{s.sub}</div>}
        </Pop>
        <div style={{ transform: `translateY(${(1 - phone) * 500}px)` }}>
          <PhoneFrame width={s.sub ? 420 : 445}>
            <OffthreadVideo src={staticFile(asset(c.file))} startFrom={Math.round(c.from * FPS)} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </PhoneFrame>
        </div>
      </Column>
    </Stage>
  )
}

// The in-call games; the picked one grows and gets a gold ring.
export function Games({ s }: { s: Of<'games'> }) {
  const { secs } = useScene()
  const t = useT()
  const pickAt = Math.min(1.5, secs * 0.45)
  const pick = useSpring(pickAt, { damping: 12, mass: 0.8, stiffness: 150 })
  const size = 180
  const headline = s.headline ?? 'Play while you talk'
  return (
    <Stage>
      <Column gap={64}>
        <Pop at={0.05}>
          <Headline size={fitSize([headline], 96, 66)}>{headline}</Headline>
        </Pop>
        <div style={{ width: 840, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 28, rowGap: 36 }}>
          {BRAND.games.map((g, i) => {
            const me = g.id === s.pick
            const dim = me ? 1 : mix(1, 0.4, ease(t, pickAt, 0.3))
            return (
              <Pop key={g.id} at={0.2 + i * 0.07} from={0.5} style={{ position: 'relative', zIndex: me ? 2 : 1 }}>
                <div style={{ width: size, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: dim, transform: `scale(${me ? mix(1, 1.18, pick) : 1})` }}>
                  <Card style={{ width: size, height: size, borderRadius: 44, background: C.tints[i % C.tints.length], display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: me ? `0 0 0 ${10 * pick}px ${C.gold}, 0 30px 60px rgba(120,90,0,0.2)` : undefined }}>
                    <Img src={staticFile(asset(g.file))} style={{ width: size * 0.62, height: size * 0.62, objectFit: 'contain' }} />
                  </Card>
                  <div style={{ width: size + 16, fontSize: 30, fontWeight: 600, lineHeight: 1.1, textAlign: 'center' }}>{g.name}</div>
                </div>
              </Pop>
            )
          })}
        </div>
      </Column>
    </Stage>
  )
}

// Feature cards with icons.
export function Features({ s }: { s: Of<'features'> }) {
  const { secs } = useScene()
  const at = stepTimes(s.items.length, secs, 0.4)
  return (
    <Stage>
      <Column align="stretch" gap={26}>
        {s.headline && (
          <Pop at={0.05} style={{ marginBottom: 30 }}>
            <Headline size={fitSize([s.headline], 100, 68)}>{s.headline}</Headline>
          </Pop>
        )}
        {s.items.map((f, i) => (
          <Pop key={f} at={at[i]} rise={40} from={0.8}>
            <Card style={{ display: 'flex', alignItems: 'center', gap: 36, padding: '30px 40px', borderRadius: 40 }}>
              <div style={{ width: 110, height: 110, borderRadius: 32, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={FEATURES[f].icon} size={60} color={C.ink} />
              </div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 56, letterSpacing: -1.5, lineHeight: 1.1 }}>{FEATURES[f].label}</div>
            </Card>
          </Pop>
        ))}
      </Column>
    </Stage>
  )
}

// Closing card: mynah, tagline, site.
export function End({ s }: { s: Of<'end'> }) {
  const logo = useSpring(0.05, { damping: 11, mass: 0.8, stiffness: 130 })
  return (
    <Stage>
      <Column gap={56} style={{ paddingBottom: 60 }}>
        <div style={{ transform: `scale(${logo}) rotate(${(1 - logo) * -14}deg)` }}><Logo size={280} /></div>
        <Pop at={0.35}>
          <Headline size={s.tagline.length > 20 ? 96 : 112}>{s.tagline}</Headline>
        </Pop>
        <Pop at={0.7} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <div style={{ padding: '34px 64px', borderRadius: 999, background: C.ink, color: '#FFF', fontFamily: DISPLAY, fontWeight: 800, fontSize: 60 }}>{BRAND.site}</div>
          <div style={{ fontSize: 42, fontWeight: 600, color: C.muted }}>{BRAND.endCard.sub}</div>
        </Pop>
      </Column>
    </Stage>
  )
}
