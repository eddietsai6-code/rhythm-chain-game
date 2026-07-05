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

test("buildLevels creates 30 levels in 4, 8, and 16 combo tiers", () => {
  const levels = buildLevels();

  assert.equal(LEVEL_COUNT, 30);
  assert.equal(levels.length, 30);

  assert.deepEqual(levels.slice(0, 10).map((level) => level.comboCount), Array(10).fill(4));
  assert.deepEqual(levels.slice(10, 20).map((level) => level.comboCount), Array(10).fill(8));
  assert.deepEqual(levels.slice(20, 30).map((level) => level.comboCount), Array(10).fill(16));
  assert.equal(getComboCountForLevel(1), 4);
  assert.equal(getComboCountForLevel(10), 4);
  assert.equal(getComboCountForLevel(11), 8);
  assert.equal(getComboCountForLevel(20), 8);
  assert.equal(getComboCountForLevel(21), 16);
  assert.equal(getComboCountForLevel(30), 16);
});

test("unlocked rhythm cards become more complex across the course", () => {
  const first = getUnlockedPatterns(1).map((pattern) => pattern.id);
  const middle = getUnlockedPatterns(15).map((pattern) => pattern.id);
  const final = getUnlockedPatterns(30).map((pattern) => pattern.id);

  assert.deepEqual(first, ["quarter", "twoEighths", "quarterRest", "eighthRestEighth"]);
  assert.ok(middle.includes("fourSixteenths"));
  assert.ok(middle.includes("dottedEighthSixteenth"));
  assert.ok(final.includes("triplet"));
  assert.ok(final.includes("syncopatedTie"));
  assert.ok(final.length > middle.length);
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

test("pattern catalog covers the reference rhythms plus expanded advanced types", () => {
  const ids = RHYTHM_PATTERNS.map((pattern) => pattern.id);
  const families = new Set(RHYTHM_PATTERNS.map((pattern) => pattern.family));

  assert.ok(ids.includes("quarter"));
  assert.ok(ids.includes("twoEighths"));
  assert.ok(ids.includes("fourSixteenths"));
  assert.ok(ids.includes("triplet"));
  assert.ok(ids.includes("dottedQuarterEighth"));
  assert.ok(ids.includes("syncopatedTie"));
  assert.ok(ids.includes("sixteenthRestRun"));
  assert.ok(RHYTHM_PATTERNS.length >= 12);
  assert.deepEqual(
    ["basic", "rests", "division", "dotted", "triplet", "syncopation"].every((family) =>
      families.has(family)
    ),
    true
  );
});

test("every combo slot schedules a visual beat pulse before inner rhythm sounds", () => {
  const chain = ["quarterRest", "twoEighths", "triplet", "syncopatedTie"];
  const events = scheduleChainEvents(chain, { bpm: 96 });
  const expectedBeatStarts = Array.from({ length: calculateChainBeats(chain) }, (_, index) => index);
  const visualBeatStarts = new Set(
    events
      .filter((event) => event.kind === "pulse")
      .map((event) => event.beat)
  );

  assert.deepEqual([...visualBeatStarts], expectedBeatStarts);
  assert.ok(events.filter((event) => event.kind === "pulse").every((event) => !event.audible));
  assert.ok(events.some((event) => event.kind === "note" && event.patternId === "triplet"));
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
  const target = ["quarter", "twoEighths", "quarterRest", "triplet"];

  assert.deepEqual(evaluatePlayerChain(target, ["quarter", "twoEighths", "quarterRest", "triplet"]), {
    passed: true,
    matched: 4,
    total: 4,
    accuracy: 1,
    mismatches: [],
  });

  assert.deepEqual(evaluatePlayerChain(target, ["quarter", "triplet", "quarterRest"]), {
    passed: false,
    matched: 2,
    total: 4,
    accuracy: 0.5,
    mismatches: [
      { index: 1, expected: "twoEighths", actual: "triplet" },
      { index: 3, expected: "triplet", actual: null },
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
  assert.deepEqual(
    SPEED_OPTIONS.map((option) => resolvePlaybackBpm(96, option.multiplier)),
    [72, 96, 120, 144]
  );
  assert.equal(resolvePlaybackBpm(96, 0.1), 48);
  assert.equal(resolvePlaybackBpm(96, 3), 192);
});

test("tap tempo tracker estimates BPM from recent tap intervals", () => {
  const tracker = createTapTempoTracker({ windowSize: 4 });

  assert.equal(tracker.tap(0), null);
  assert.equal(tracker.tap(500), 120);
  assert.equal(tracker.tap(1000), 120);
  assert.equal(tracker.tap(1500), 120);
  assert.equal(tracker.tap(5000), null);
});
