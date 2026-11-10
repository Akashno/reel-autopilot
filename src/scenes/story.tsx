// Picture scenes for story reels (borrowed from Untold Files): the story's own objects, drawn by
// Claude as small SVGs (reel.props), the people in it, and the numbers that matter. Each thing
// appears on the word that names it (`on`), so the picture follows the voice.
import type { ReactNode } from 'react'
import { Img } from 'remotion'
import type { PropMove, Scene } from '../types'
import { C, Card, Chip, Column, DISPLAY, ease, Face, fitSize, Headline, mix, Pop, Stage, stepTimes, useScene, useSpring, useT, useWordAt } from '../ui'

type Of<T extends Scene['type']> = Extract<Scene, { type: T }>

// A prop is only ever drawn as an image, so nothing inside it can run (scripts/check.ts also
// refuses anything that isn't plain shapes).
export function PropArt({ name, size }: { name: string, size: number }) {
  const { props } = useScene()
  const svg = props?.find(p => p.name === name)?.svg
  if (!svg)
    return <div style={{ width: size, height: size }} />
  return <Img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} style={{ width: size, height: size, display: 'block' }} />
}

// How a prop arrives and moves, from `at` seconds.
function Mover({ move = 'pop', at, children }: { move?: PropMove, at: number, children: ReactNode }) {
  const t = useT()
  const bouncy = useSpring(at, { damping: 9, mass: 0.9, stiffness: 120 })
  const soft = useSpring(at)
  const since = t - at
  let transform = ''
  let opacity = 1
  switch (move) {
    case 'pop':
      transform = `scale(${mix(0.3, 1, bouncy)})`
      opacity = Math.min(1, soft * 2)
      break
    case 'float':
      transform = `translateY(${Math.sin(t * 2.2) * 22}px) rotate(${Math.sin(t * 1.3) * 3}deg) scale(${mix(0.85, 1, soft)})`
      opacity = Math.min(1, soft * 2)
      break
    case 'drop':
      transform = `translateY(${(1 - bouncy) * -1100}px) rotate(${(1 - bouncy) * -14}deg)`
      opacity = since > -0.05 ? 1 : 0
      break
    case 'shake': {
      const k = since > 0 && since < 0.9 ? Math.sin(since * 50) * 9 * (1 - since / 0.9) : 0
      transform = `rotate(${k}deg) translateX(${k * 2}px)`
      break
    }
    case 'spin':
      transform = `rotate(${ease(t, at, 1.1) * 360}deg) scale(${mix(0.4, 1, soft)})`
      opacity = Math.min(1, soft * 2)
      break
    case 'slide':
      transform = `translateX(${(1 - soft) * 1000}px) rotate(${(1 - soft) * 10}deg)`
      opacity = since > -0.05 ? 1 : 0
      break
    case 'grow':
      transform = `scale(${ease(t, at, 1.3)})`
      break
  }
  return <div style={{ transform, opacity }}>{children}</div>
}

// A pinned paper slip of text.
function Slip({ text, at, tilt = -3 }: { text: string, at: number, tilt?: number }) {
  return (
    <Pop at={at} from={0.7} rise={30}>
      <div style={{ transform: `rotate(${tilt}deg)`, background: '#FFFDF4', color: C.ink, padding: '22px 44px', borderRadius: 14, boxShadow: '0 0 0 2px rgba(80,60,0,0.08), 0 18px 40px rgba(60,40,0,0.25)', fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize([text], 72, 48, 760), letterSpacing: -1, textTransform: 'uppercase', textAlign: 'center' }}>
        {text}
      </div>
    </Pop>
  )
}

// A slow push-in over the whole scene, so even a still picture is moving.
function usePush() {
  const { secs } = useScene()
  return `scale(${mix(1, 1.06, Math.min(1, useT() / secs))})`
}

// Never leave the screen empty while waiting for a cue word: things that ARRIVE (pop, drop,
// slide, grow, float) come in by this time at the latest; shake and spin act on their word.
const ARRIVE_BY = 0.5

export function PropScene({ s }: { s: Of<'prop'> }) {
  const cue = useWordAt(s.on, 0.1)
  const at = s.move === 'shake' || s.move === 'spin' ? cue : Math.min(cue, ARRIVE_BY)
  const textAt = useWordAt(s.textOn, Math.max(at + 0.5, 0.6))
  return (
    <Stage night={s.night}>
      <Column captions gap={20} style={{ transform: usePush() }}>
        <Mover move={s.move} at={at}><PropArt name={s.prop} size={680} /></Mover>
        {s.text && <Slip text={s.text} at={textAt} />}
      </Column>
    </Stage>
  )
}

export function People({ s }: { s: Of<'people'> }) {
  const { secs } = useScene()
  const n = s.people.length
  const size = n === 1 ? 460 : n === 2 ? 360 : 250
  const steps = stepTimes(n + (s.item ? 1 : 0), Math.min(secs, 2.6), 0.08, 0.4)
  const ats = s.people.map((p, i) => Math.min(useWordAt(p.on, steps[i]), ARRIVE_BY + i * 0.9))
  const itemAt = useWordAt(undefined, steps[n] ?? 0.9)
  const textAt = useWordAt(s.textOn, Math.max(...ats, itemAt) + 0.5)
  return (
    <Stage night={s.night}>
      <Column captions gap={50} style={{ transform: usePush() }}>
        <div style={{ display: 'flex', gap: n === 3 ? 30 : 50, alignItems: 'flex-end', justifyContent: 'center' }}>
          {s.people.map((p, i) => (
            <Pop key={i} at={ats[i]} rise={60} from={0.7}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
                {p.avatar
                  ? <Face avatar={p.avatar} size={size} />
                  : (
                      <div style={{ width: size, height: size, borderRadius: size * 0.28, background: C.tints[(i + 1) % C.tints.length], boxShadow: `0 0 0 ${Math.max(4, size * 0.03)}px #FFF, 0 24px 50px rgba(120,90,0,0.22)`, overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        {p.prop && <PropArt name={p.prop} size={size * 0.95} />}
                      </div>
                    )}
                <Chip dark style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: n === 3 ? 34 : 42, padding: '12px 30px' }}>{p.label}</Chip>
              </div>
            </Pop>
          ))}
        </div>
        {s.item && (
          <Mover move="pop" at={itemAt}><PropArt name={s.item} size={n === 1 ? 300 : 340} /></Mover>
        )}
        {s.text && <Slip text={s.text} at={textAt} tilt={2} />}
      </Column>
    </Stage>
  )
}

export function Count({ s }: { s: Of<'count'> }) {
  const { secs } = useScene()
  const steps = stepTimes(s.items.length, secs, 0.15)
  const ats = s.items.map((it, i) => useWordAt(it.on, steps[i]))
  const n = s.items.length
  const size = fitSize(s.items.map(i => i.value), n === 1 ? 300 : n === 2 ? 210 : 160, 110)
  return (
    <Stage>
      <Column captions gap={n === 1 ? 0 : 34}>
        {s.items.map((it, i) => (
          <Pop key={i} at={ats[i]} rise={50} from={0.6}>
            <Card style={{ padding: n === 1 ? '50px 80px' : '26px 60px', borderRadius: 40, background: i % 2 ? C.card : C.gold, textAlign: 'center', transform: `rotate(${i % 2 ? 2 : -2}deg)` }}>
              <Headline size={size} style={{ lineHeight: 1 }}>{it.value}</Headline>
              <div style={{ fontSize: n === 1 ? 60 : 46, fontWeight: 600, color: C.ink, marginTop: 10 }}>{it.label}</div>
            </Card>
          </Pop>
        ))}
      </Column>
    </Stage>
  )
}
