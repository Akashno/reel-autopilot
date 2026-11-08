import { Composition } from 'remotion'
import sample from '../brand/examples/sample.json'
import type { Reel, ReelProps } from './types'
import { calculateMetadata, ReelVideo } from './Reel'
import { FPS, H, W } from './ui'

// One composition; scripts/make.ts passes the day's reel, voice folder and clip lengths as props.
// In the Studio it shows brand/examples/sample.json silent, with each line given a guessed length.
const reel = sample as Reel
const guess = reel.scenes.map(s => (s.say ? s.say.split(/\s+/).length * 0.36 : null))

export function Root() {
  return (
    <Composition
      id="Reel"
      component={ReelVideo}
      calculateMetadata={calculateMetadata}
      durationInFrames={FPS * 20}
      fps={FPS}
      width={W}
      height={H}
      defaultProps={{ reel, audioDir: null, voSecs: guess } satisfies ReelProps}
    />
  )
}
