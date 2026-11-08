import { interpolate } from 'remotion'
import type { Scene } from '../types'
import { C, Card, Chip, Column, ease, fitSize, Headline, Icon, mix, Pop, DISPLAY, Stage, stepTimes, useScene, useSpring, useT, withMarker } from '../ui'

type Of<T extends Scene['type']> = Extract<Scene, { type: T }>

// Big kinetic headline, line by line, with an optional gold marker. Sits a little above
// centre, where the eye lands first.
export function Hook({ s }: { s: Of<'hook'> }) {
  const { secs } = useScene()
  const t = useT()
  const size = fitSize(s.lines, 160, 88)
  const zoom = mix(1, 1.04, Math.min(1, t / secs))
  return (
    <Stage>
      <Column gap={0} style={{ paddingBottom: 120, transform: `scale(${zoom})` }}>
        {s.lines.map((line, i) => (
          <Pop key={i} at={0.08 + i * 0.22} rise={70}>
            <Headline size={size}>{withMarker(line, s.highlight, 0.3 + s.lines.length * 0.22)}</Headline>
          </Pop>
        ))}
      </Column>
    </Stage>
  )
}

// "POV" chip, then the situation typed out with a blinking cursor. The full text is laid
// out invisibly underneath so nothing moves while it types.
export function Pov({ s: raw }: { s: Of<'pov'> }) {
  // The chip already says POV.
  const s = { ...raw, text: raw.text.replace(/^\s*pov\s*[:\-]?\s*/i, '') }
  const { secs } = useScene()
  const t = useT()
  const typeEnd = Math.min(secs - 0.8, 0.5 + s.text.length * 0.035)
  const shown = Math.round(s.text.length * ease(t, 0.5, Math.max(0.3, typeEnd - 0.5)))
  const size = s.text.length > 44 ? 84 : 98
  const text = { fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.12, letterSpacing: -2 } as const
  return (
    <Stage>
      <Column align="flex-start" gap={40} style={{ paddingBottom: 100 }}>
        <Pop at={0.05} from={0.8}>
          <Chip dark style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 52, padding: '16px 38px' }}>POV</Chip>
        </Pop>
        <div style={{ position: 'relative', ...text }}>
          <span style={{ opacity: 0 }}>{s.text}</span>
          <div style={{ position: 'absolute', inset: 0 }}>
            {s.text.slice(0, shown)}
            <span style={{ display: 'inline-block', width: 8, height: size * 0.9, marginLeft: 6, verticalAlign: 'text-bottom', background: C.ink, opacity: Math.floor(t * 2.5) % 2 ? 0 : 1 }} />
          </div>
        </div>
      </Column>
    </Stage>
  )
}

// One giant word or number that slams in.
export function BigWord({ s }: { s: Of<'bigword'> }) {
  const p = useSpring(0.05, { damping: 9, mass: 0.8, stiffness: 150 })
  const size = fitSize([s.word], 360, 150)
  return (
    <Stage>
      <Column gap={36} style={{ paddingBottom: 100 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: size * 1.25 }}>
          <div style={{ position: 'absolute', width: size * 1.4, height: size * 1.4, borderRadius: '50%', background: C.gold, opacity: 0.55, transform: `scale(${p})` }} />
          <Headline size={size} style={{ position: 'relative', whiteSpace: 'nowrap', transform: `scale(${mix(2.2, 1, p)}) rotate(${(1 - p) * -8}deg)`, opacity: Math.min(1, p * 2) }}>{s.word}</Headline>
        </div>
        {s.sub && (
          <Pop at={0.55}>
            <div style={{ fontSize: 58, fontWeight: 600, color: C.muted, textAlign: 'center' }}>{s.sub}</div>
          </Pop>
        )}
      </Column>
    </Stage>
  )
}

// Would-you-rather: question, two cards, and a nudge to comment.
export function Question({ s }: { s: Of<'question'> }) {
  const { secs } = useScene()
  const opt = (label: string, text: string, tint: string, at: number) => (
    <Pop at={at} rise={80}>
      <Card style={{ width: 400, height: 400, background: tint, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 32 }}>
        <div style={{ width: 104, height: 104, borderRadius: '50%', background: C.ink, color: '#FFF', fontFamily: DISPLAY, fontWeight: 800, fontSize: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{label}</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: text.length > 14 ? 50 : 60, lineHeight: 1.1, textAlign: 'center', letterSpacing: -1 }}>{text}</div>
      </Card>
    </Pop>
  )
  return (
    <Stage>
      <Column gap={64}>
        <Pop at={0.05}>
          <Headline size={s.question.length > 30 ? 88 : 104}>{s.question}</Headline>
        </Pop>
        <div style={{ display: 'flex', gap: 40 }}>
          {opt('A', s.a, C.tints[0], 0.45)}
          {opt('B', s.b, C.tints[3], 0.7)}
        </div>
        <Pop at={Math.max(1.2, secs - 1.6)}>
          <Chip dark style={{ fontSize: 44 }}>Comment A or B</Chip>
        </Pop>
      </Column>
    </Stage>
  )
}

// Numbered list, one item at a time.
export function List({ s }: { s: Of<'list'> }) {
  const { secs } = useScene()
  const at = stepTimes(s.items.length, secs, 0.45)
  return (
    <Stage>
      <Column align="stretch" gap={26}>
        <Pop at={0.05} style={{ marginBottom: 30 }}>
          <Headline size={fitSize([s.title], 100, 68)}>{s.title}</Headline>
        </Pop>
        {s.items.map((item, i) => (
          <Pop key={i} at={at[i]} rise={30} from={0.85}>
            <Card style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '28px 36px', borderRadius: 36 }}>
              <div style={{ width: 84, height: 84, borderRadius: '50%', background: C.gold, fontFamily: DISPLAY, fontWeight: 800, fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15 }}>{item}</div>
            </Card>
          </Pop>
        ))}
      </Column>
    </Stage>
  )
}

// Playful star ratings.
export function Rating({ s }: { s: Of<'rating'> }) {
  const { secs } = useScene()
  const t = useT()
  const at = stepTimes(s.items.length, secs, 0.45)
  return (
    <Stage>
      <Column align="stretch" gap={26}>
        <Pop at={0.05} style={{ marginBottom: 30 }}>
          <Headline size={fitSize([s.title], 100, 68)}>{s.title}</Headline>
        </Pop>
        {s.items.map((item, i) => (
          <Pop key={i} at={at[i]} rise={30} from={0.85}>
            <Card style={{ padding: '30px 40px', borderRadius: 36, background: C.tints[i % C.tints.length] }}>
              <div style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15, marginBottom: 16 }}>{item.label}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {Array.from({ length: 5 }, (_, k) => {
                  const on = k < item.stars && t > at[i] + 0.25 + k * 0.09
                  return <Icon key={k} name="star" size={56} color={on ? '#B98900' : '#CFC6AE'} fill={on ? C.gold : 'none'} />
                })}
              </div>
            </Card>
          </Pop>
        ))}
      </Column>
    </Stage>
  )
}

// Top/bottom comparison with a VS badge between the cards.
export function Versus({ s }: { s: Of<'versus'> }) {
  const { secs } = useScene()
  const t = useT()
  const second = Math.min(1.4, secs * 0.4)
  const half = (side: { label: string, text: string }, tint: string, at: number, dim: boolean) => (
    <Pop at={at} rise={50} from={0.9}>
      <Card style={{ height: 380, padding: '44px 48px', background: tint, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, alignItems: 'flex-start', opacity: dim ? mix(1, 0.55, ease(t, second + 0.3, 0.4)) : 1 }}>
        <Chip dark={!dim} style={{ fontSize: 36, padding: '10px 28px' }}>{side.label}</Chip>
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: side.text.length > 28 ? 66 : 78, lineHeight: 1.08, letterSpacing: -2 }}>{side.text}</div>
      </Card>
    </Pop>
  )
  const vs = useSpring(second - 0.1)
  return (
    <Stage>
      <Column align="stretch" gap={0}>
        {half(s.left, '#EFE8D6', 0.05, true)}
        <div style={{ display: 'flex', justifyContent: 'center', height: 40, position: 'relative', zIndex: 2 }}>
          <div style={{ marginTop: -55, width: 150, height: 150, borderRadius: '50%', background: C.gold, boxShadow: '0 0 0 10px #FFF', fontFamily: DISPLAY, fontWeight: 800, fontSize: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${vs}) rotate(${interpolate(vs, [0, 1], [-30, 0])}deg)` }}>VS</div>
        </div>
        {half(s.right, C.tints[2], second, false)}
      </Column>
    </Stage>
  )
}
