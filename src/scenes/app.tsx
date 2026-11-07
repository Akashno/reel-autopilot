import { Img, OffthreadVideo, staticFile } from 'remotion'
import type { Clip, Game, Scene } from '../types'
import { Bubble, C, Card, center, Chip, Dot, ease, Face, FEATURES, fitSize, FPS, Headline, Icon, mix, Mynah, PhoneFrame, Pop, SORA, Stage, stepTimes, useScene, useSpring, useT, Wave } from '../ui'

type Of<T extends Scene['type']> = Extract<Scene, { type: T }>

const timer = (s: number) => `00:${String(Math.floor(Math.max(0, s))).padStart(2, '0')}`

function CallButtons({ top }: { top: number }) {
  const btn = (icon: string, bg: string, color: string, size: number) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(17,17,16,0.06), 0 12px 26px rgba(120,90,0,0.16)' }}>
      <Icon name={icon} size={size * 0.42} color={color} />
    </div>
  )
  return (
    <div style={{ ...center, top, gap: 56 }}>
      {btn('mic', '#FFF', C.ink, 130)}
      {btn('phone-off', C.red, '#FFF', 180)}
      {btn('message-circle', '#FFF', C.ink, 130)}
    </div>
  )
}

// Searching rings, then the stranger pops in: "You are connected to <name>".
export function Match({ s }: { s: Of<'match'> }) {
  const { index } = useScene()
  const t = useT()
  const found = 1.3
  const card = useSpring(found, { damping: 11, mass: 0.8, stiffness: 140 })
  const searching = 1 - ease(t, found - 0.15, 0.2)
  return (
    <Stage seed={index}>
      <div style={{ ...center, top: 520, height: 520 }}>
        {[0, 1, 2].map(i => {
          const p = ((t + i * 0.45) % 1.35) / 1.35
          return <div key={i} style={{ position: 'absolute', width: mix(200, 820, p), height: mix(200, 820, p), borderRadius: '50%', border: `6px solid ${C.ink}`, opacity: (1 - p) * 0.35 * searching }} />
        })}
        <div style={{ position: 'absolute', opacity: searching, fontFamily: SORA, fontWeight: 800, fontSize: 64 }}>Matching{'.'.repeat(1 + Math.floor(t * 3) % 3)}</div>
        <div style={{ position: 'absolute', transform: `scale(${card}) rotate(${(1 - card) * 10}deg)`, opacity: Math.min(1, card * 2) }}>
          <Face avatar={s.avatar} size={400} />
        </div>
      </div>
      <Pop at={found + 0.15} style={{ ...center, top: 360 }}>
        <Chip style={{ background: C.callGreen, color: '#FFF', fontSize: 38 }}><Icon name="phone" size={38} color="#FFF" />You are connected to {s.name}</Chip>
      </Pop>
      <Pop at={found + 0.3} style={{ ...center, top: 1080, flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 84, letterSpacing: -2 }}>{s.name}</div>
        <div style={{ fontSize: 42, fontWeight: 600, color: C.green }}><Dot />Connected · {timer(t - found)}</div>
      </Pop>
    </Stage>
  )
}

// On a voice call: face, live waveform, timer and call buttons.
export function Call({ s }: { s: Of<'call'> }) {
  const { index } = useScene()
  const t = useT()
  const start = 37 + (index * 13) % 50
  return (
    <Stage seed={index} tint="#F3E3B0">
      {s.label && (
        <Pop at={0.05} style={{ ...center, top: 300 }}><Chip dark>{s.label}</Chip></Pop>
      )}
      <Pop at={0.1} style={{ ...center, top: 430 }}><Face avatar={s.avatar} size={380} /></Pop>
      <Pop at={0.25} style={{ ...center, top: 860, flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 80, letterSpacing: -2 }}>{s.name}</div>
        <div style={{ fontSize: 42, fontWeight: 600, color: C.green }}><Dot />Connected · 0{Math.floor((start + t) / 60)}:{String(Math.floor(start + t) % 60).padStart(2, '0')}</div>
      </Pop>
      <Pop at={0.35} style={{ ...center, top: 1030 }}><Wave height={130} bars={19} /></Pop>
      <Pop at={0.45}><CallButtons top={1190} /></Pop>
    </Stage>
  )
}

// Text chat: header with the stranger, bubbles one by one.
export function Chat({ s }: { s: Of<'chat'> }) {
  const { secs, index } = useScene()
  const at = stepTimes(s.messages.length, secs, 0.5)
  const t = useT()
  // Older bubbles drift up once there are more than four.
  const shift = s.messages.length > 4 ? ease(t, at[4] - 0.2, 0.3) * 150 : 0
  return (
    <Stage seed={index}>
      <Pop at={0.05} style={{ position: 'absolute', left: 70, right: 70, top: 290 }}>
        <Card style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '24px 32px', borderRadius: 36 }}>
          <Face avatar={s.avatar} size={100} />
          <div>
            <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 50 }}>{s.name}</div>
            <div style={{ fontSize: 34, fontWeight: 600, color: C.green }}><Dot size={14} />Connected</div>
          </div>
        </Card>
      </Pop>
      <div style={{ position: 'absolute', left: 70, right: 70, top: 520, bottom: 560, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, transform: `translateY(${-shift}px)` }}>
          {s.messages.map((m, i) => (
            <Pop key={i} at={at[i]} rise={40} from={0.8} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', transformOrigin: m.from === 'me' ? 'right bottom' : 'left bottom' }}>
              <Bubble text={m.text} me={m.from === 'me'} />
            </Pop>
          ))}
        </div>
      </div>
    </Stage>
  )
}

// Real screen recordings: which part of each to play.
const CLIPS: Record<Clip, { from: number, to: number, length: number }> = {
  '2am': { from: 0.4, to: 9, length: 16.5 },
  'english': { from: 0.8, to: 11.5, length: 15.5 },
  'games': { from: 1, to: 12, length: 14.4 },
  'safety': { from: 0.4, to: 13.5, length: 14.4 },
  'translate': { from: 0, to: 14.5, length: 15.3 },
}
export function AppClip({ s }: { s: Of<'appclip'> }) {
  const { secs, index } = useScene()
  const c = CLIPS[s.clip]
  // Fit the interesting part into the scene, never running past the end of the file.
  const rate = Math.min(3, Math.max(0.7, (c.to - c.from) / secs), (c.length - 0.2 - c.from) / secs)
  const phone = useSpring(0.1, { damping: 16, mass: 1, stiffness: 110 })
  return (
    <Stage seed={index}>
      <Pop at={0.05} style={{ position: 'absolute', left: 60, right: 60, top: 270 }}>
        <Headline size={fitSize([s.headline], 92, 66)}>{s.headline}</Headline>
        {s.sub && <div style={{ marginTop: 14, fontSize: 42, fontWeight: 600, color: C.muted, textAlign: 'center' }}>{s.sub}</div>}
      </Pop>
      <div style={{ ...center, top: s.sub ? 520 : 470, transform: `translateY(${(1 - phone) * 500}px)` }}>
        <PhoneFrame width={520}>
          <OffthreadVideo src={staticFile(`clips/${s.clip}.mp4`)} startFrom={Math.round(c.from * FPS)} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </PhoneFrame>
      </div>
    </Stage>
  )
}

const GAMES: Array<{ id: Game, name: string, src: string }> = [
  { id: 'uno', name: 'UNO', src: 'games/uno.svg' },
  { id: 'ludo', name: 'Ludo', src: 'games/ludo.svg' },
  { id: 'tictactoe', name: 'Tic-Tac-Toe', src: 'games/tictactoe.svg' },
  { id: 'chainreaction', name: 'Chain Reaction', src: 'games/chainreaction.svg' },
  { id: 'battleship', name: 'Battleship', src: 'games/battleship-160.webp' },
  { id: 'sudoku', name: 'Sudoku', src: 'games/sudoku-160.webp' },
  { id: 'tetris', name: 'Tetris', src: 'games/tetris-160.webp' },
]
// The in-call games; the picked one grows and gets a gold ring.
export function Games({ s }: { s: Of<'games'> }) {
  const { secs, index } = useScene()
  const t = useT()
  const pickAt = Math.min(1.5, secs * 0.45)
  const pick = useSpring(pickAt, { damping: 12, mass: 0.8, stiffness: 150 })
  const size = 210
  return (
    <Stage seed={index}>
      <Pop at={0.05} style={{ position: 'absolute', left: 60, right: 60, top: 280 }}>
        <Headline size={fitSize([s.headline ?? 'Play while you talk'], 92, 66)}>{s.headline ?? 'Play while you talk'}</Headline>
      </Pop>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 500, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 36, rowGap: 40, padding: '0 50px' }}>
        {GAMES.map((g, i) => {
          const me = g.id === s.pick
          const dim = me ? 1 : mix(1, 0.4, ease(t, pickAt, 0.3))
          return (
            <Pop key={g.id} at={0.2 + i * 0.07} from={0.5} style={{ position: 'relative', zIndex: me ? 2 : 1 }}>
              <div style={{ width: size, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: dim, transform: `scale(${me ? mix(1, 1.18, pick) : 1})` }}>
                <Card style={{ width: size, height: size, borderRadius: 50, background: C.tints[i % C.tints.length], display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: me ? `0 0 0 ${10 * pick}px ${C.gold}, 0 30px 60px rgba(120,90,0,0.2)` : undefined }}>
                  <Img src={staticFile(g.src)} style={{ width: size * 0.62, height: size * 0.62, objectFit: 'contain' }} />
                </Card>
                <div style={{ fontSize: 34, fontWeight: 600, whiteSpace: 'nowrap' }}>{g.name}</div>
              </div>
            </Pop>
          )
        })}
      </div>
    </Stage>
  )
}

// Feature chips with icons.
export function Features({ s }: { s: Of<'features'> }) {
  const { secs, index } = useScene()
  const at = stepTimes(s.items.length, secs, 0.4)
  return (
    <Stage seed={index}>
      {s.headline && (
        <Pop at={0.05} style={{ position: 'absolute', left: 60, right: 60, top: 320 }}>
          <Headline size={fitSize([s.headline], 96, 66)}>{s.headline}</Headline>
        </Pop>
      )}
      {s.items.map((f, i) => (
        <Pop key={f} at={at[i]} rise={40} from={0.8} style={{ position: 'absolute', left: 90, right: 90, top: (s.headline ? 560 : 460) + i * 200 }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 36, padding: '30px 40px', borderRadius: 40 }}>
            <div style={{ width: 110, height: 110, borderRadius: 32, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={FEATURES[f].icon} size={60} color={C.ink} />
            </div>
            <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 56, letterSpacing: -1.5 }}>{FEATURES[f].label}</div>
          </Card>
        </Pop>
      ))}
    </Stage>
  )
}

// Closing card: mynah, tagline, site.
export function End({ s }: { s: Of<'end'> }) {
  const { index } = useScene()
  const logo = useSpring(0.05, { damping: 11, mass: 0.8, stiffness: 130 })
  return (
    <Stage seed={index}>
      <div style={{ ...center, top: 360, transform: `scale(${logo}) rotate(${(1 - logo) * -14}deg)` }}><Mynah size={300} /></div>
      <Pop at={0.35} style={{ position: 'absolute', left: 70, right: 70, top: 740 }}>
        <Headline size={s.tagline.length > 20 ? 92 : 108}>{s.tagline}</Headline>
      </Pop>
      <Pop at={0.7} style={{ ...center, top: 1110 }}>
        <div style={{ padding: '34px 64px', borderRadius: 999, background: C.ink, color: '#FFF', fontFamily: SORA, fontWeight: 800, fontSize: 56 }}>randomtalker.com</div>
      </Pop>
      <Pop at={1} style={{ ...center, top: 1290 }}>
        <div style={{ fontSize: 42, fontWeight: 600, color: C.muted }}>Free to start · link in bio</div>
      </Pop>
    </Stage>
  )
}
