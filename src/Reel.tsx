import { linearTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import type { CalculateMetadataFunction } from 'remotion'
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion'
import type { ReelProps, Scene, SceneType } from './types'
import { AppClip, Call, Chat, End, Features, Games, Match } from './scenes/app'
import { BigWord, Hook, List, Pov, Question, Rating, Versus } from './scenes/text'
import { BOX, C, CAPTIONED, FPS, Guides, SceneCtx, DISPLAY, useFonts } from './ui'

const T = 8 // crossfade frames
const VO_AT = 0.25 // voice starts this far into its scene
const TAIL = 0.6 // breathing room after the voice ends
const sec = (s: number) => Math.round(s * FPS)

// How long a scene needs for its own animation, before the voice is taken into account.
function minSecs(s: Scene): number {
  switch (s.type) {
    case 'hook': return 1.6 + s.lines.length * 0.25
    case 'pov': return Math.max(2.4, 1.4 + s.text.length * 0.035)
    case 'bigword': return 1.8
    case 'question': return 3.6
    case 'match': return 3.2
    case 'call': return 2.8
    case 'chat': return 1.4 + s.messages.length * 0.9
    case 'appclip': return 3.6
    case 'games': return 3.2
    case 'features': return 1.3 + s.items.length * 0.8
    case 'list': return 1.4 + s.items.length * 0.8
    case 'rating': return 1.4 + s.items.length * 0.95
    case 'versus': return 3.4
    case 'end': return 3.2
  }
}

export function sceneSecs({ reel, voSecs }: Pick<ReelProps, 'reel' | 'voSecs'>) {
  return reel.scenes.map((s, i) => Math.max(minSecs(s), voSecs[i] != null ? VO_AT + voSecs[i]! + TAIL : 0))
}

function layout(secs: number[]) {
  const starts: number[] = []
  let at = 0
  for (const s of secs) {
    starts.push(at)
    at += sec(s) - T
  }
  return { starts, total: at + T }
}

export const calculateMetadata: CalculateMetadataFunction<ReelProps> = ({ props }) => ({
  durationInFrames: layout(sceneSecs(props)).total,
})

function View({ s }: { s: Scene }) {
  switch (s.type) {
    case 'hook': return <Hook s={s} />
    case 'pov': return <Pov s={s} />
    case 'bigword': return <BigWord s={s} />
    case 'question': return <Question s={s} />
    case 'match': return <Match s={s} />
    case 'call': return <Call s={s} />
    case 'chat': return <Chat s={s} />
    case 'appclip': return <AppClip s={s} />
    case 'games': return <Games s={s} />
    case 'features': return <Features s={s} />
    case 'list': return <List s={s} />
    case 'rating': return <Rating s={s} />
    case 'versus': return <Versus s={s} />
    case 'end': return <End s={s} />
  }
}


// Burned-in captions: a few words at a time, the current word in gold. Word timing is
// estimated from character counts across the clip, which is close enough for speech.
function Captions({ text, secs }: { text: string, secs: number }) {
  const t = useCurrentFrame() / FPS
  const words = text.split(/\s+/).filter(Boolean)
  const total = words.reduce((n, w) => n + w.length + 1, 0)
  let acc = 0
  const timed = words.map((w) => {
    const start = (acc / total) * secs
    acc += w.length + 1
    return { w, start, end: (acc / total) * secs }
  })
  const chunks: typeof timed[] = []
  for (const w of timed) {
    const last = chunks[chunks.length - 1]
    if (last && last.length < 4 && last.map(x => x.w).join(' ').length + w.w.length < 24)
      last.push(w)
    else
      chunks.push([w])
  }
  const chunk = chunks.find(c => t < c[c.length - 1].end + 0.05) ?? chunks[chunks.length - 1]
  if (!chunk || t > secs + 0.3)
    return null
  return (
    <div style={{ position: 'absolute', left: BOX.left, right: BOX.right, top: BOX.captionTop, display: 'flex', justifyContent: 'center' }}>
      <div style={{ padding: '18px 36px', borderRadius: 28, background: 'rgba(17,17,16,0.9)', fontFamily: DISPLAY, fontWeight: 800, fontSize: 58, letterSpacing: -1, color: '#FFF', textAlign: 'center', lineHeight: 1.15 }}>
        {chunk.map((x, i) => (
          <span key={i} style={{ color: t >= x.start && t < x.end + 0.05 ? C.gold : '#FFF' }}>{i ? ' ' : ''}{x.w}</span>
        ))}
      </div>
    </div>
  )
}

export function ReelVideo(props: ReelProps) {
  useFonts()
  const { reel, audioDir, voSecs } = props
  const secs = sceneSecs(props)
  const { starts } = layout(secs)
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <TransitionSeries>
        {reel.scenes.flatMap((s, i) => [
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={sec(secs[i])} name={`${i} ${s.type}`}>
            <SceneCtx.Provider value={{ secs: secs[i], index: i }}>
              <View s={s} />
              {s.say && voSecs[i] != null && (CAPTIONED as readonly SceneType[]).includes(s.type) && (
                <Sequence from={sec(VO_AT)} layout="none"><Captions text={s.say} secs={voSecs[i]!} /></Sequence>
              )}
            </SceneCtx.Provider>
          </TransitionSeries.Sequence>,
          ...(i < reel.scenes.length - 1 ? [<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />] : []),
        ])}
      </TransitionSeries>

      {audioDir && reel.scenes.map((s, i) => s.say && voSecs[i] != null && (
        <Sequence key={`vo${i}`} from={starts[i] + sec(VO_AT)} durationInFrames={sec(voSecs[i]!) + 3} name={`VO ${i}`}>
          <Audio src={staticFile(`${audioDir}/s${i}.wav`)} />
        </Sequence>
      ))}

      {starts.slice(1).map((at, i) => (
        <Sequence key={`sfx${i}`} from={Math.max(0, at - 4)} durationInFrames={sec(1.2)} name="swoosh">
          <Audio src={staticFile(i % 2 ? 'sfx/swipe.mp3' : 'sfx/swoosh.mp3')} volume={0.12} />
        </Sequence>
      ))}

      {props.guides && <Guides />}
    </AbsoluteFill>
  )
}
