# Rhythm Chain Game

A dependency-free browser rhythm game for building rhythm chains from colored rhythm cards.

The game includes 100 levels split across three roman-numbered practice stages.
Page I covers levels 1-40 as the beginner stage, Page II covers levels 41-80
as the intermediate stage, and Page III covers levels 81-100 as the advanced
stage. The advanced stage adds septuplets in levels 81-90 and octuplets in
levels 91-100, mixed with previously learned rhythms.
Level 1 starts with 4 rhythm
combinations, later stages reach 8 and 16 combinations, and every beat has an
audible pulse plus each rhythm card's own Web Audio note events.

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
