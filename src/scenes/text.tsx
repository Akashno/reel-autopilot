import { interpolate } from 'remotion'
import type { Scene } from '../types'
import { C, Card, center, Chip, ease, fitSize, Headline, Icon, mix, Pop, SORA, Stage, stepTimes, useScene, useSpring, useT, withMarker } from '../ui'

type Of<T extends Scene['type']> = Extract<Scene, { type: T }>

// Big kinetic headline, line by line, with an optional gold marker.
export function Hook({ s }: { s: Of<'hook'> }) {
  const { secs, index } = useScene()
  const t = useT()
  const size = fitSize(s.lines, 150, 84)
  const zoom = mix(1, 1.05, Math.min(1, t / secs))
  const top = 800 - (s.lines.length * size * 1.05) / 2
  return (
    <Stage seed={index}>
      <div style={{ position: 'absolute', left: 50, right: 50, top, transform: `scale(${zoom})` }}>
        {s.lines.map((line, i) => (
          <Pop key={i} at={0.08 + i * 0.22} rise={70}>
            <Headline size={size}>{withMarker(line, s.highlight, 0.3 + s.lines.length * 0.22)}</Headline>
          </Pop>
        ))}
      </div>
    </Stage>
  )
}

// "POV" chip, then the situation typed out with a blinking cursor.
export function Pov({ s: raw }: { s: Of<'pov'> }) {
  // The chip already says POV.
  const s = { ...raw, text: raw.text.replace(/^\s*pov\s*[:\-]?\s*/i, '') }
  const { secs, index } = useScene()
  const t = useT()
  const typeEnd = Math.min(secs - 0.8, 0.5 + s.text.length * 0.035)
  const shown = Math.round(s.text.length * ease(t, 0.5, Math.max(0.3, typeEnd - 0.5)))
  const size = s.text.length > 44 ? 80 : 92
  return (
    <Stage seed={index}>
      <Pop at={0.05} style={{ position: 'absolute', left: 80, top: 470 }}>
        <Chip dark style={{ fontFamily: SORA, fontWeight: 800, fontSize: 56, padding: '18px 40px' }}>POV</Chip>
      </Pop>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 620, fontFamily: SORA, fontWeight: 800, fontSize: size, lineHeight: 1.12, letterSpacing: -2 }}>
        {s.text.slice(0, shown)}
        <span style={{ display: 'inline-block', width: 8, height: size * 0.9, marginLeft: 6, verticalAlign: 'text-bottom', background: C.ink, opacity: Math.floor(t * 2.5) % 2 ? 0 : 1 }} />
      </div>
    </Stage>
  )
}

// One giant word or number that slams in.
export function BigWord({ s }: { s: Of<'bigword'> }) {
  const { index } = useScene()
  const p = useSpring(0.05, { damping: 9, mass: 0.8, stiffness: 150 })
  const size = fitSize([s.word], 380, 150, 980)
  return (
    <Stage seed={index}>
      <div style={{ ...center, top: 520, height: size * 1.4 }}>
        <div style={{ position: 'absolute', width: size * 1.5, height: size * 1.5, borderRadius: '50%', background: C.gold, opacity: 0.55, transform: `scale(${p})` }} />
        <Headline size={size} style={{ position: 'relative', transform: `scale(${mix(2.2, 1, p)}) rotate(${(1 - p) * -8}deg)`, opacity: Math.min(1, p * 2) }}>{s.word}</Headline>
      </div>
      {s.sub && (
        <Pop at={0.55} style={{ ...center, top: 560 + size * 1.4 }}>
          <div style={{ fontSize: 54, fontWeight: 600, color: C.muted, textAlign: 'center', maxWidth: 900 }}>{s.sub}</div>
        </Pop>
      )}
    </Stage>
  )
}

// Would-you-rather: question, two cards, and a nudge to comment.
export function Question({ s }: { s: Of<'question'> }) {
  const { secs, index } = useScene()
  const opt = (label: string, text: string, tint: string, at: number) => (
    <Pop at={at} rise={80}>
      <Card style={{ width: 440, height: 440, background: tint, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 36 }}>
        <div style={{ width: 110, height: 110, borderRadius: '50%', background: C.ink, color: '#FFF', fontFamily: SORA, fontWeight: 800, fontSize: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{label}</div>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: text.length > 14 ? 50 : 60, lineHeight: 1.1, textAlign: 'center', letterSpacing: -1 }}>{text}</div>
      </Card>
    </Pop>
  )
  return (
    <Stage seed={index}>
      <Pop at={0.05} style={{ position: 'absolute', left: 70, right: 70, top: 330 }}>
        <Headline size={s.question.length > 30 ? 84 : 100}>{s.question}</Headline>
      </Pop>
      <div style={{ ...center, top: 780, gap: 40 }}>
        {opt('A', s.a, C.tints[0], 0.45)}
        {opt('B', s.b, C.tints[3], 0.7)}
      </div>
      <Pop at={Math.max(1.2, secs - 1.6)} style={{ ...center, top: 1245 }}>
        <Chip dark>Comment A or B</Chip>
      </Pop>
    </Stage>
  )
}

// Numbered list, one item at a time.
export function List({ s }: { s: Of<'list'> }) {
  const { secs, index } = useScene()
  const at = stepTimes(s.items.length, secs, 0.45)
  const rowH = s.items.length > 4 ? 150 : 170
  return (
    <Stage seed={index}>
      <Pop at={0.05} style={{ position: 'absolute', left: 70, right: 70, top: 300 }}>
        <Headline size={fitSize([s.title], 92, 64)}>{s.title}</Headline>
      </Pop>
      {s.items.map((item, i) => (
        <Pop key={i} at={at[i]} rise={30} from={0.85} style={{ position: 'absolute', left: 70, right: 70, top: 480 + i * rowH }}>
          <Card style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '26px 36px', borderRadius: 36 }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: C.gold, fontFamily: SORA, fontWeight: 800, fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 50, fontWeight: 600, lineHeight: 1.15 }}>{item}</div>
          </Card>
        </Pop>
      ))}
    </Stage>
  )
}

// Playful star ratings.
export function Rating({ s }: { s: Of<'rating'> }) {
  const { secs, index } = useScene()
  const t = useT()
  const at = stepTimes(s.items.length, secs, 0.45)
  return (
    <Stage seed={index}>
      <Pop at={0.05} style={{ position: 'absolute', left: 70, right: 70, top: 300 }}>
        <Headline size={fitSize([s.title], 92, 64)}>{s.title}</Headline>
      </Pop>
      {s.items.map((item, i) => (
        <Pop key={i} at={at[i]} rise={30} from={0.85} style={{ position: 'absolute', left: 70, right: 70, top: 490 + i * 205 }}>
          <Card style={{ padding: '28px 40px', borderRadius: 36, background: C.tints[i % C.tints.length] }}>
            <div style={{ fontSize: 50, fontWeight: 600, marginBottom: 14 }}>{item.label}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {Array.from({ length: 5 }, (_, k) => {
                const on = k < item.stars && t > at[i] + 0.25 + k * 0.09
                return <Icon key={k} name="star" size={56} color={on ? '#B98900' : '#CFC6AE'} fill={on ? C.gold : 'none'} />
              })}
            </div>
          </Card>
        </Pop>
      ))}
    </Stage>
  )
}

// Top/bottom comparison with a VS badge.
export function Versus({ s }: { s: Of<'versus'> }) {
  const { secs, index } = useScene()
  const t = useT()
  const second = Math.min(1.4, secs * 0.4)
  const half = (side: { label: string, text: string }, top: number, tint: string, at: number, dim: boolean) => (
    <Pop at={at} rise={50} from={0.9} style={{ position: 'absolute', left: 70, right: 70, top }}>
      <Card style={{ height: 420, padding: '40px 48px', background: tint, opacity: dim ? mix(1, 0.55, ease(t, second + 0.3, 0.4)) : 1 }}>
        <Chip dark={!dim} style={{ fontSize: 34, padding: '10px 26px' }}>{side.label}</Chip>
        <div style={{ marginTop: 30, fontFamily: SORA, fontWeight: 800, fontSize: side.text.length > 28 ? 64 : 76, lineHeight: 1.08, letterSpacing: -2 }}>{side.text}</div>
      </Card>
    </Pop>
  )
  const vs = useSpring(second - 0.1)
  return (
    <Stage seed={index}>
      {half(s.left, 300, '#EFE8D6', 0.05, true)}
      {half(s.right, 820, C.tints[2], second, false)}
      <div style={{ ...center, top: 700, height: 160, transform: `scale(${vs}) rotate(${interpolate(vs, [0, 1], [-30, 0])}deg)` }}>
        <div style={{ width: 150, height: 150, borderRadius: '50%', background: C.gold, boxShadow: '0 0 0 10px #FFF', fontFamily: SORA, fontWeight: 800, fontSize: 58, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>VS</div>
      </div>
    </Stage>
  )
}
