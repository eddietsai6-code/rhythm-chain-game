import test from "node:test";
import assert from "node:assert/strict";

import {
  COUNT_IN_BEATS,
  LEVEL_COUNT,
  SOUND_PRESETS,
  SNARE_TONE,
  SPEED_OPTIONS,
  RHYTHM_PATTERNS,
  buildLevels,
  calculateChainBeats,
  createTapTempoTracker,
  createTargetChain,
  evaluatePlayerChain,
  getComboCountForLevel,
  getLevelConfig,
  getPatternById,
  getUnlockedPatterns,
  resolvePlaybackBpm,
  scheduleChainEvents,
  scheduleCountInEvents,
} from "../assets/rhythm-core.js";

test("buildLevels creates 40 levels in 4, 8, and 16 combo tiers", () => {
  const levels = buildLevels();

  assert.equal(LEVEL_COUNT, 40);
  assert.equal(levels.length, 40);

  assert.deepEqual(levels.slice(0, 10).map((level) => level.comboCount), Array(10).fill(4));
  assert.deepEqual(levels.slice(10, 20).map((level) => level.comboCount), Array(10).fill(8));
  assert.deepEqual(levels.slice(20, 40).map((level) => level.comboCount), Array(20).fill(16));
  assert.equal(getComboCountForLevel(1), 4);
  assert.equal(getComboCountForLevel(10), 4);
  assert.equal(getComboCountForLevel(11), 8);
  assert.equal(getComboCountForLevel(20), 8);
  assert.equal(getComboCountForLevel(21), 16);
  assert.equal(getComboCountForLevel(40), 16);
});

test("unlocked rhythm cards become more complex across the course", () => {
  const first = getUnlockedPatterns(1).map((pattern) => pattern.id);
  const middle = getUnlockedPatterns(15).map((pattern) => pattern.id);
  const preSyncopation = getUnlockedPatterns(30).map((pattern) => pattern.id);
  const final = getUnlockedPatterns(40).map((pattern) => pattern.id);

  assert.deepEqual(first, ["quarter", "twoEighths", "quarterRest", "eighthRestEighth"]);
  assert.ok(middle.includes("fourSixteenths"));
  assert.ok(middle.includes("eighthTwoSixteenths"));
  assert.ok(preSyncopation.includes("twoSixteenthsEighth"));
  assert.ok(!preSyncopation.includes("sixteenthEighthSixteenth"));
  assert.ok(!preSyncopation.includes("sixteenthRestThreeSixteenths"));
  assert.ok(final.includes("sixteenthEighthSixteenth"));
  assert.ok(final.includes("sixteenthRestThreeSixteenths"));
  assert.ok(final.length > preSyncopation.length);
});

test("target chains are deterministic, sized by level, and use only unlocked patterns", () => {
  const level = getLevelConfig(22);
  const firstChain = createTargetChain(level);
  const secondChain = createTargetChain(level);
  const unlocked = new Set(getUnlockedPatterns(level.level).map((pattern) => pattern.id));

  assert.deepEqual(firstChain, secondChain);
  assert.equal(firstChain.length, level.comboCount);
  assert.ok(firstChain.every((patternId) => unlocked.has(patternId)));
});

test("pattern catalog only uses theory-safe one-beat quarter, eighth, and sixteenth cards", () => {
  const ids = RHYTHM_PATTERNS.map((pattern) => pattern.id);
  const families = new Set(RHYTHM_PATTERNS.map((pattern) => pattern.family));

  assert.deepEqual(ids, [
    "quarter",
    "twoEighths",
    "quarterRest",
    "eighthRestEighth",
    "eighthEighthRest",
    "fourSixteenths",
    "eighthTwoSixteenths",
    "twoSixteenthsEighth",
    "sixteenthEighthSixteenth",
    "sixteenthRestThreeSixteenths",
  ]);
  assert.deepEqual([...families].sort(), ["basic", "division", "rests", "syncopation"]);
  assert.ok(RHYTHM_PATTERNS.every((pattern) => pattern.beats === 1));
  assert.ok(RHYTHM_PATTERNS.every((pattern) => pattern.symbol !== "♪ ♪"));
  assert.equal(getPatternById("sixteenthEighthSixteenth").color, "gold");
  assert.equal(getPatternById("sixteenthRestThreeSixteenths").color, "orange");
  assert.ok(!ids.some((id) => /triplet|dotted|tie|restRun|offbeat|mixed|anticipation/i.test(id)));
});

test("every combo slot schedules a visual beat pulse before inner rhythm sounds", () => {
  const chain = ["quarterRest", "twoEighths", "eighthTwoSixteenths", "twoSixteenthsEighth"];
  const events = scheduleChainEvents(chain, { bpm: 96 });
  const expectedBeatStarts = Array.from({ length: calculateChainBeats(chain) }, (_, index) => index);
  const visualBeatStarts = new Set(
    events
      .filter((event) => event.kind === "pulse")
      .map((event) => event.beat)
  );

  assert.deepEqual([...visualBeatStarts], expectedBeatStarts);
  assert.ok(events.filter((event) => event.kind === "pulse").every((event) => !event.audible));
  assert.ok(events.some((event) => event.kind === "note" && event.patternId === "eighthTwoSixteenths"));
  assert.ok(events.every((event) => Number.isFinite(event.timeSeconds)));
});

test("rest-only cards stay silent during playback", () => {
  const audibleEvents = scheduleChainEvents(["quarterRest"], { bpm: 96 }).filter((event) => event.audible);

  assert.deepEqual(audibleEvents, []);
});

test("four sixteenth notes schedule exactly four audible subdivisions", () => {
  assert.equal(getPatternById("fourSixteenths").glyph, "four-sixteenth-run");

  const audibleEvents = scheduleChainEvents(["fourSixteenths"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => ({ kind: event.kind, beat: event.beat }));

  assert.deepEqual(audibleEvents, [
    { kind: "note", beat: 0 },
    { kind: "note", beat: 0.25 },
    { kind: "note", beat: 0.5 },
    { kind: "note", beat: 0.75 },
  ]);
});

test("front-eighth/back-sixteenth and front-sixteenth/back-eighth cards sound in the right order", () => {
  const frontEighthBackSixteenth = scheduleChainEvents(["eighthTwoSixteenths"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);
  const frontSixteenthBackEighth = scheduleChainEvents(["twoSixteenthsEighth"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);

  assert.deepEqual(frontEighthBackSixteenth, [0, 0.5, 0.75]);
  assert.deepEqual(frontSixteenthBackEighth, [0, 0.25, 0.5]);
});

test("level 31 syncopation cards schedule one-beat sixteenth sounds correctly", () => {
  const sixteenthEighthSixteenth = scheduleChainEvents(["sixteenthEighthSixteenth"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);
  const sixteenthRestThreeSixteenths = scheduleChainEvents(["sixteenthRestThreeSixteenths"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);

  assert.deepEqual(sixteenthEighthSixteenth, [0, 0.25, 0.75]);
  assert.deepEqual(sixteenthRestThreeSixteenths, [0.25, 0.5, 0.75]);
  assert.equal(getPatternById("sixteenthEighthSixteenth").beats, 1);
  assert.equal(getPatternById("sixteenthRestThreeSixteenths").beats, 1);
});

test("all generated target chains avoid removed triplet, dotted, syncopated, and cross-beat cards", () => {
  const allowedIds = new Set(RHYTHM_PATTERNS.map((pattern) => pattern.id));
  const removedIds = new Set([
    "dottedEighthSixteenth",
    "sixteenthDottedEighth",
    "eighthRestTwoSixteenths",
    "dottedQuarterEighth",
    "triplet",
    "sixteenthRestRun",
    "offbeatEighths",
    "syncopatedTie",
    "mixedSixteenthRest",
    "anticipation",
  ]);

  for (const level of buildLevels()) {
    const chain = createTargetChain(level);
    assert.ok(chain.every((patternId) => allowedIds.has(patternId)));
    assert.ok(chain.every((patternId) => !removedIds.has(patternId)));
  }
});

test("count-in schedules four audible prep beats before playback", () => {
  const bpm = 120;
  const beatDuration = 60 / bpm;
  const countInEvents = scheduleCountInEvents({ bpm, startTime: 10 });
  const chainEvents = scheduleChainEvents(["quarter"], {
    bpm,
    startTime: 10 + COUNT_IN_BEATS * beatDuration,
  });

  assert.equal(COUNT_IN_BEATS, 4);
  assert.deepEqual(
    countInEvents.map((event) => ({
      kind: event.kind,
      audible: event.audible,
      countIndex: event.countIndex,
      timeSeconds: event.timeSeconds,
    })),
    [
      { kind: "countIn", audible: true, countIndex: 0, timeSeconds: 10 },
      { kind: "countIn", audible: true, countIndex: 1, timeSeconds: 10.5 },
      { kind: "countIn", audible: true, countIndex: 2, timeSeconds: 11 },
      { kind: "countIn", audible: true, countIndex: 3, timeSeconds: 11.5 },
    ]
  );
  assert.equal(chainEvents[0].timeSeconds, 12);
});

test("getPatternById returns immutable pattern definitions", () => {
  const quarter = getPatternById("quarter");

  assert.equal(quarter.label, "Quarter");
  assert.throws(() => {
    quarter.label = "Changed";
  });
  assert.equal(getPatternById("quarter").label, "Quarter");
});

test("evaluatePlayerChain requires the player's chain to match the target exactly", () => {
  const target = ["quarter", "twoEighths", "quarterRest", "fourSixteenths"];

  assert.deepEqual(evaluatePlayerChain(target, ["quarter", "twoEighths", "quarterRest", "fourSixteenths"]), {
    passed: true,
    matched: 4,
    total: 4,
    accuracy: 1,
    mismatches: [],
  });

  assert.deepEqual(evaluatePlayerChain(target, ["quarter", "fourSixteenths", "quarterRest"]), {
    passed: false,
    matched: 2,
    total: 4,
    accuracy: 0.5,
    mismatches: [
      { index: 1, expected: "twoEighths", actual: "fourSixteenths" },
      { index: 3, expected: "fourSixteenths", actual: null },
    ],
  });
});

test("scheduled audio events use snare tone only", () => {
  const chain = RHYTHM_PATTERNS.map((pattern) => pattern.id);
  const events = scheduleChainEvents(chain, { bpm: 108 });
  const unexpectedTones = events
    .filter((event) => event.audible)
    .map((event) => event.tone)
    .filter((tone) => tone !== SNARE_TONE);

  assert.deepEqual(unexpectedTones, []);
  assert.ok(events.some((event) => event.tone === SNARE_TONE));
});

test("sound presets expose snare as the default plus common alternate effects", () => {
  const ids = SOUND_PRESETS.map((preset) => preset.id);

  assert.equal(ids[0], SNARE_TONE);
  assert.deepEqual(ids, ["snare", "kick", "closedHat", "clap", "woodblock"]);
});

test("speed options scale the level BPM predictably", () => {
  assert.ok(buildLevels().every((level) => level.bpm === 80));
  assert.deepEqual(
    SPEED_OPTIONS.map((option) => resolvePlaybackBpm(80, option.multiplier)),
    [60, 80, 100, 120]
  );
  assert.equal(resolvePlaybackBpm(80, 0.1), 40);
  assert.equal(resolvePlaybackBpm(80, 3), 160);
});

test("tap tempo tracker estimates BPM from recent tap intervals", () => {
  const tracker = createTapTempoTracker({ windowSize: 4 });

  assert.equal(tracker.tap(0), null);
  assert.equal(tracker.tap(500), 120);
  assert.equal(tracker.tap(1000), 120);
  assert.equal(tracker.tap(1500), 120);
  assert.equal(tracker.tap(5000), null);
});
