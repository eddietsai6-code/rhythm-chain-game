# Rhythm Chain Game

A dependency-free browser rhythm game for building rhythm chains from colored rhythm cards.

The game includes 80 levels split across roman-numbered difficulty pages. Page I
covers levels 1-40, Page II covers levels 41-50 with additional one-beat
advanced rhythms, and Page III covers levels 51-60 with triplet and reverse
syncopation rhythms. Page IV covers levels 61-70 with quintuplet and sextuplet
rhythms mixed together with earlier cards. Page V covers levels 71-80 with
quintuplet and sextuplet rest variants that continue mixing with earlier cards.
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
