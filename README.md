# randomtalker-autopilot

Makes one Random Talker reel a day with no one in the loop: Claude writes a small JSON file,
this repo turns it into a 1080x1920 MP4, and Buffer posts it to Instagram, YouTube, Facebook and X.

Claude never writes video code. It picks scenes from a fixed library and fills in their text;
`reel.schema.json` limits every field (lengths, real features only, known avatars, clips and
games), and `scripts/check.ts` adds the rules a schema can't express.

## Commands

    npm install
    npm run check -- reels/sample.json              validate a reel
    npm run make -- reels/sample.json               voice + render + verify -> out/sample.mp4
    npm run make -- reels/sample.json --silent      no voice, for layout checks
    npm run studio                                  preview reels/sample.json
    npm run write [-- --date YYYY-MM-DD]            Claude writes reels/<date>.json
    npm run daily [-- --date YYYY-MM-DD] [--test]   write + make + record in data/history.json

## Daily script (Claude)

`write` runs headless Claude Code (`claude -p`, your subscription; `CLAUDE_MODEL`, default
`sonnet`) with `prompts/system.md` and `prompts/brief.md` (product facts, tone, scene guide),
today's angle from `data/angles.json` (least recently used first) and the last 30 videos from
`data/history.json`. The answer must match `reel.schema.json`; it is then checked by
`scripts/check.ts` and for novelty (idea and hook similarity, repeated scene sequence, opener
type, reused nicknames). Rejections go back to Claude with the reasons, up to 3 attempts.
One reel costs roughly 10-20k tokens.

## Voice

One Gemini text-to-speech request per reel (free tier: 10 requests a day), cut into lines at
the long pauses. If Gemini fails, is out of quota, or the cut doesn't line up, Piper voices
every line locally (free, unlimited). Set up Piper once:

    uv venv .venv && uv pip install --python .venv/bin/python piper-tts
    .venv/bin/python -m piper.download_voices --download-dir voices en_US-ryan-high

`GEMINI_API_KEY` goes in the environment or `.env`.

## Scene library

| type | what it shows |
|---|---|
| `hook` | 1-3 big lines, optional gold marker under a phrase |
| `pov` | "POV" chip and a situation typed out |
| `bigword` | one giant word or number |
| `question` | would-you-rather with two option cards |
| `match` | matching rings, then "You are connected to <name>" |
| `call` | voice call: avatar, waveform, timer, call buttons |
| `chat` | text-chat bubbles one by one |
| `appclip` | real screen recording in a phone (`2am`, `english`, `games`, `safety`, `translate`) |
| `games` | the 7 in-call games, one picked |
| `features` | 2-4 feature cards, only from the fixed feature list |
| `list` | numbered list |
| `rating` | star ratings |
| `versus` | top/bottom comparison with a VS badge |
| `end` | mynah, tagline, randomtalker.com (always last) |

Each scene may have one voiceover line (`say`). A scene lasts as long as its animation or its
line, whichever is longer; captions are burned in except on scenes whose text is the line.

## Layout

Content stays between y=250 and y=1520 (Instagram covers the top and bottom with its own UI).
Captions sit at y=1390. Fonts, logo, avatars, game icons and sound effects are in `public/`;
the clips in `public/clips/` are recordings of the real app.

## Roadmap

1. Scene library and renderer (done)
2. Daily script from `claude -p` with the schema and history (done)
3. GitHub Actions render and Release upload
4. Buffer posting (account 1: Instagram, YouTube, Facebook; account 2: X)
5. Dry-run week, then go live
