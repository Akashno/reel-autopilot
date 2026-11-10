# What makes a reel work

## The hook (scene 1) decides everything

People decide in about one second whether to keep watching. The hook must make sense instantly,
with no context, to someone half-paying attention, often with the sound off.

- 7 words at most on screen. Plain everyday words a 19-year-old would actually say. No wordplay
  that needs a second read, no invented terms, no brand name.
- Concrete beats abstract: a time, a place, a number, a specific moment ("2:14 AM", "your third
  hour of scrolling", "the friend who never calls back").
- The first voice line says the hook itself (or nearly), 10 words at most.
- Use one of these patterns, and brainstorm several in `idea.hookOptions` before choosing:
  - **Call-out**: names who it's for. "Awake at 2am again?" / "If your English is better in your head"
  - **Confession**: a small honest admission. "I talk to strangers to practise English"
  - **Mini-story start**: drops into a moment. "A stranger called me Biscuit for an hour"
  - **Contrarian**: says the opposite of what people expect. "Texting is killing your conversations"
  - **Specific curiosity**: a detail that begs a question. "He only spoke in movie quotes"
  - **Relatable pain**: a feeling everyone has had. "Nobody to talk to on a Sunday"
- Bad hooks (never like these): "Remember the stranger button?" (nobody calls it that),
  "Unlock real connections" (ad slop), "Ever wondered...?" (filler), "{{name}} is here!" (brand first).

## The story: one idea, five beats

Every reel is a tiny story with a turn, not a feature tour:
1. **Hook**: the moment or feeling.
2. **Tension**: make it real or funny (a chat, a rating, a versus, a POV moment). Do not open twice:
   scene 2 is never another hook/pov/bigword.
3. **Product moment**: the product in action ({{productScenes}}), with ONE
   person (if the scenes show one) who keeps the same name and avatar in every scene they appear in.
4. **Payoff**: a twist, a punchline or a small warm moment that rewards watching to the end.
5. **End card**: a tagline that closes the loop with the hook.

5-7 scenes including the end, 15-22 seconds. At most one `features` or `list` scene.

## Words: fewer, plainer, human

- Voiceover 25-55 words in total; one short sentence per scene, 14 words at most. On scenes that
  already show text (pov, chat, list, rating, versus, question, features) the voice line is 10 words
  at most and adds something; never read the screen aloud there.
- Write like a person talking, with contractions and rhythm. Specific and a bit funny beats general
  and inspiring. Chats should read like real messages: lowercase is fine, typos are not.
- Never use: "turns out", "game changer", "here's the thing", "real connection", "meaningful",
  "vibes", "energy", "butterflies", "unlock", "elevate", "seamless", "dive in", "journey", "level up",
  "next level", "in a world where", "say goodbye to", "it's giving", "main character", "hits
  different", "magic", "connect with people", "endless", "effortless", "ready to", "trust me",
  "literally", "more than just", "not just X but Y", "whether you're", "the power of", "same thrill",
  em dashes. They mark the video as AI-written and people scroll. Say the actual thing instead.
- One idea per video. If a line doesn't serve the idea, cut it.

## Story reels (idea.format "story")

Some days are a story instead of a skit: one narrated story the viewer wants to hear the end of.
The rules above still apply, except these:

- **The voice tells ONE story across all the scenes**, like a person telling a friend something
  great: full flowing sentences with connecting words ("but", "so", "which meant", "and then").
  Read together, the `say` lines must sound like one story, not a list of captions. Each `say` is
  the next part of it and ends at a natural pause (a full stop, or a comma mid-sentence).
- **Shape**: hook (the strangest true fact, stated plainly) -> setup (who, where, when) ->
  escalation -> **twist** -> a short last line that lands the point. The turn is the reason to watch.
- **The hook is the whole game.** Scene 1's voice states the surprising part as a plain fact in its
  first words, 16 words at most, and says the same thing as the screen. Never open with a year, a
  place or scene-setting ("In 1914...", "Back in...", "There was...", "Meet...", "Imagine..."):
  the year and place go in scene 2. Patterns: "Two strangers have shared Thanksgiving for nine years
  because of one wrong text." / "Soldiers stopped a war to play football with the enemy."
- 6-9 scenes including the end, 55-80 words of voice, up to 18 per scene (14 on scenes that show
  text). Every scene has a voice line, and **every picture shows exactly what its line is about**:
  `prop` for the story's objects (the text message, the football, the bottle), `people` for who it
  happened to, `count` or `bigword` for a year or a number, `chat` for a message exchange. At least
  2 picture scenes (prop, people, count), and at least one drawn prop. `on` words make each thing
  appear as it is said; they must be words in that scene's `say`.

### Drawing props (`props`)

Draw 1-3 key things from the story as small SVG pictures, by `name` (lowercase, e.g. "phone",
"grandma", "turkey"), and use every one in a `prop` or `people` scene. A person the avatars don't
fit (an old woman, a soldier in 1914) is a prop too, used in `people`.
- `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">`, transparent background, the
  object centred and filling about 70% of the box, under 4000 characters.
- Flat vector style: simple bold shapes (path, rect, circle, ellipse, polygon, g), 3-7 colours,
  light from the upper left (a lighter highlight shape upper left, a darker shade lower right), a
  soft shadow ellipse under it (fill="#000" opacity=".15"). 10-25 shapes with the details that make
  it unmistakable at phone size. A person: head, hair, face, clothes and hands, shown waist up.
- No text, letters, numbers, logos or brand marks. No script, image, style, filter, use or links.
- **The product only closes the story.** No product scene in the middle. The story's point leads
  to {{name}} at the end: optionally one product scene in the last two before the end card, and an
  end-card tagline that ties the story's point to talking to someone new. One plain line, no pitch.
- **True stories** (when today says so): only events that good encyclopedias or the original study
  agree on. Every name, date and number must be in `idea.sources`; if you are not sure of a detail,
  leave it out. Little known, with a twist. No invented quotes: in a `chat` scene, show messages
  only as the well-known paraphrase, and never put words in real people's mouths. Respectful.
- **Fiction** (mini-drama): clearly a story, told by a narrator. Never "this happened to me", never
  "a user told us", no fake reviews or numbers.

## Post text

- Caption (post.caption): 1-3 short lines that add to the video, a question that invites comments
  when it fits, then the call to action with {{site}}. Hashtags separately: 3-8, always
  including {{hashtag}}.
- youtubeTitle: the hook, sharpened, plus #shorts. xText: one punchy line plus {{site}}.

# Scene library

- `hook`: 1-3 big lines (each <=18 chars) with an optional gold underline on a phrase. The punchiest opener.
- `pov`: "POV" chip + a relatable situation typed out (<=70 chars; don't start it with "POV", the chip says that). Great opener.
- `bigword`: one giant word or number (<=10 chars) + small line under it. E.g. "3 taps", "2 AM", "Hello?".
- `question`: would-you-rather with two option cards; invites comments. Good near the end.
- `match`: matching rings, then the stranger's avatar and nickname pop in as connected.
- `call`: an ongoing voice call with an avatar, waveform, timer; optional small label like "2:14 AM".
- `chat`: 2-5 short text bubbles between "me" and "them" (<=48 chars each). Make them sound like real people: funny, warm, specific.
- `appclip`: a real screen recording of the product in a phone. Clips: {{clips}}.
- `games`: grid of the games with one picked: {{games}}.
- `features`: 2-4 cards from: {{features}}.
- `list`: numbered list of 3-5 short items.
- `rating`: 2-4 things rated 1-5 stars (types of people, openers, situations).
- `versus`: top vs bottom comparison (expectation/reality, before/after, old way/new way).
- `prop`: a big close-up of one of your drawn `props` that moves (`move`: pop, float, drop, shake, spin, slide, grow) on the word `on`, with an optional paper slip `text` (<=28 chars) on `textOn`. `night: true` for a night sky.
- `people`: 1-3 people with name `label`s (<=18 chars), each an app avatar or one of your props (a drawn person: a grandmother, a soldier), popping on their `on` word; optional `item` prop with them and a slip `text`.
- `count`: 1-3 big number cards (`value` <=8 chars, `label`), each popping on its `on` word. Perfect for the payoff.
- `end`: logo, your tagline (<=32 chars), {{site}}. Always last, only once.

Avatars: {{avatars}}.
No two scenes of the same type back to back.
