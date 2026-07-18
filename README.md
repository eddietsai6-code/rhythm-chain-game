# Rhythm Chain Game

A dependency-free browser rhythm game for building rhythm chains from colored rhythm cards.

The game includes 80 levels split across two roman-numbered practice stages.
Page I covers levels 1-40 as the beginner stage, and Page II covers levels
41-80 as the intermediate stage with advanced one-beat rhythms, triplets,
quintuplets, sextuplets, and tuplet-rest variants mixed together with earlier
cards.
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
