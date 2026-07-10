# Rhythm Chain Game

A dependency-free browser rhythm game for building rhythm chains from colored rhythm cards.

The game includes 40 levels. Level 1 starts with 4 rhythm combinations and
the final level reaches 16 combinations. Rhythm cards unlock gradually from
quarter notes, eighth notes, and rests into theory-safe one-beat sixteenth-note
groups, with syncopation cards added in levels 31-40. Every beat has an audible
pulse, and each rhythm card adds its own Web Audio note events.

Live site: https://rhythm-chain-game.pages.dev/

## Run

```bash
python -m http.server 4196 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4196/`.

## Test

```bash
node --test tests/rhythm-core.test.mjs
```
