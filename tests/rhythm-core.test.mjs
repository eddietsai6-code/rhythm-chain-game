import test from "node:test";
import assert from "node:assert/strict";

import {
  COUNT_IN_BEATS,
  LEVEL_COUNT,
  LEVEL_PAGES,
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
  getLevelPage,
  getPatternById,
  getUnlockedPatterns,
  resolvePlaybackBpm,
  scheduleChainEvents,
  scheduleCountInEvents,
} from "../assets/rhythm-core.js";

test("buildLevels creates 80 levels across roman-numbered pages", () => {
  const levels = buildLevels();

  assert.equal(LEVEL_COUNT, 80);
  assert.equal(levels.length, 80);
  assert.deepEqual(
    LEVEL_PAGES.map((page) => ({ label: page.label, startLevel: page.startLevel, endLevel: page.endLevel, locked: page.locked })),
    [
      { label: "I", startLevel: 1, endLevel: 40, locked: false },
      { label: "II", startLevel: 41, endLevel: 50, locked: false },
      { label: "III", startLevel: 51, endLevel: 60, locked: false },
      { label: "IV", startLevel: 61, endLevel: 70, locked: false },
      { label: "V", startLevel: 71, endLevel: 80, locked: false },
    ]
  );

  assert.deepEqual(levels.slice(0, 10).map((level) => level.comboCount), Array(10).fill(4));
  assert.deepEqual(levels.slice(10, 20).map((level) => level.comboCount), Array(10).fill(8));
  assert.deepEqual(levels.slice(20, 80).map((level) => level.comboCount), Array(60).fill(16));
  assert.equal(getComboCountForLevel(1), 4);
  assert.equal(getComboCountForLevel(10), 4);
  assert.equal(getComboCountForLevel(11), 8);
  assert.equal(getComboCountForLevel(20), 8);
  assert.equal(getComboCountForLevel(21), 16);
  assert.equal(getComboCountForLevel(80), 16);
  assert.equal(getLevelPage(37).label, "I");
  assert.equal(getLevelPage(41).label, "II");
  assert.equal(getLevelPage(51).label, "III");
  assert.equal(getLevelPage(61).label, "IV");
  assert.equal(getLevelPage(71).label, "V");
});

test("unlocked rhythm cards become more complex across the course", () => {
  const first = getUnlockedPatterns(1).map((pattern) => pattern.id);
  const middle = getUnlockedPatterns(15).map((pattern) => pattern.id);
  const preSyncopation = getUnlockedPatterns(30).map((pattern) => pattern.id);
  const final = getUnlockedPatterns(40).map((pattern) => pattern.id);
  const advanced = getUnlockedPatterns(41).map((pattern) => pattern.id);
  const challenge = getUnlockedPatterns(51).map((pattern) => pattern.id);
  const expert = getUnlockedPatterns(61).map((pattern) => pattern.id);
  const master = getUnlockedPatterns(71).map((pattern) => pattern.id);

  assert.deepEqual(first, ["quarter", "twoEighths", "quarterRest", "eighthRestEighth"]);
  assert.ok(middle.includes("fourSixteenths"));
  assert.ok(middle.includes("eighthTwoSixteenths"));
  assert.ok(preSyncopation.includes("twoSixteenthsEighth"));
  assert.ok(!preSyncopation.includes("sixteenthEighthSixteenth"));
  assert.ok(!preSyncopation.includes("sixteenthRestThreeSixteenths"));
  assert.ok(final.includes("sixteenthEighthSixteenth"));
  assert.ok(final.includes("sixteenthRestThreeSixteenths"));
  assert.ok(final.length > preSyncopation.length);
  assert.ok(!final.includes("eighthRestTwoSixteenths"));
  assert.ok(advanced.includes("eighthRestTwoSixteenths"));
  assert.ok(advanced.includes("dottedEighthSixteenth"));
  assert.ok(advanced.includes("twoSixteenthsEighthRest"));
  assert.ok(!advanced.includes("eighthTriplet"));
  assert.ok(challenge.includes("eighthTriplet"));
  assert.ok(challenge.includes("tripletRestMiddle"));
  assert.ok(challenge.includes("sixteenthRestDottedEighth"));
  assert.ok(!challenge.includes("quintuplet"));
  assert.ok(expert.includes("quintuplet"));
  assert.ok(expert.includes("sextuplet"));
  assert.ok(!expert.includes("quintupletRestFirst"));
  assert.ok(master.includes("quintupletRestFirst"));
  assert.ok(master.includes("quintupletRestMiddle"));
  assert.ok(master.includes("sextupletRestMiddle"));
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
    "eighthRestTwoSixteenths",
    "dottedEighthSixteenth",
    "twoSixteenthsEighthRest",
    "eighthTriplet",
    "tripletRestMiddle",
    "sixteenthRestDottedEighth",
    "quintuplet",
    "sextuplet",
    "quintupletRestFirst",
    "quintupletRestMiddle",
    "sextupletRestMiddle",
  ]);
  assert.deepEqual([...families].sort(), ["basic", "division", "rests", "syncopation", "tuplets"]);
  assert.ok(RHYTHM_PATTERNS.every((pattern) => pattern.beats === 1));
  assert.ok(RHYTHM_PATTERNS.every((pattern) => pattern.symbol !== "♪ ♪"));
  assert.equal(getPatternById("sixteenthEighthSixteenth").color, "gold");
  assert.equal(getPatternById("sixteenthRestThreeSixteenths").color, "orange");
  assert.equal(getPatternById("eighthRestTwoSixteenths").color, "lime");
  assert.equal(getPatternById("dottedEighthSixteenth").color, "violet");
  assert.equal(getPatternById("twoSixteenthsEighthRest").color, "gold");
  assert.equal(getPatternById("eighthTriplet").color, "violet");
  assert.equal(getPatternById("tripletRestMiddle").color, "lime");
  assert.equal(getPatternById("sixteenthRestDottedEighth").color, "silver");
  assert.equal(getPatternById("quintuplet").color, "orange");
  assert.equal(getPatternById("sextuplet").color, "blue");
  assert.equal(getPatternById("quintupletRestFirst").color, "gold");
  assert.equal(getPatternById("quintupletRestMiddle").color, "orange");
  assert.equal(getPatternById("sextupletRestMiddle").color, "violet");
  assert.ok(!ids.some((id) => /tie|restRun|offbeat|mixed|anticipation/i.test(id)));
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

test("level 41 advanced cards schedule the referenced one-beat rhythms", () => {
  const eighthRestTwoSixteenths = scheduleChainEvents(["eighthRestTwoSixteenths"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);
  const dottedEighthSixteenth = scheduleChainEvents(["dottedEighthSixteenth"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);
  const twoSixteenthsEighthRest = scheduleChainEvents(["twoSixteenthsEighthRest"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);

  assert.deepEqual(eighthRestTwoSixteenths, [0.5, 0.75]);
  assert.deepEqual(dottedEighthSixteenth, [0, 0.75]);
  assert.deepEqual(twoSixteenthsEighthRest, [0, 0.25]);
  assert.equal(getPatternById("eighthRestTwoSixteenths").beats, 1);
  assert.equal(getPatternById("dottedEighthSixteenth").beats, 1);
  assert.equal(getPatternById("twoSixteenthsEighthRest").beats, 1);
});

test("level 51 triplet and reverse syncopation cards schedule the referenced one-beat rhythms", () => {
  const eighthTriplet = scheduleChainEvents(["eighthTriplet"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => Number(event.beat.toFixed(3)));
  const tripletRestMiddle = scheduleChainEvents(["tripletRestMiddle"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => Number(event.beat.toFixed(3)));
  const sixteenthRestDottedEighth = scheduleChainEvents(["sixteenthRestDottedEighth"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => event.beat);

  assert.deepEqual(eighthTriplet, [0, 0.333, 0.667]);
  assert.deepEqual(tripletRestMiddle, [0, 0.667]);
  assert.deepEqual(sixteenthRestDottedEighth, [0.25]);
  assert.equal(getPatternById("eighthTriplet").beats, 1);
  assert.equal(getPatternById("tripletRestMiddle").beats, 1);
  assert.equal(getPatternById("sixteenthRestDottedEighth").beats, 1);
});

test("level 61 quintuplet and sextuplet cards schedule the referenced one-beat rhythms", () => {
  const quintuplet = scheduleChainEvents(["quintuplet"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => Number(event.beat.toFixed(3)));
  const sextuplet = scheduleChainEvents(["sextuplet"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => Number(event.beat.toFixed(3)));

  assert.deepEqual(quintuplet, [0, 0.2, 0.4, 0.6, 0.8]);
  assert.deepEqual(sextuplet, [0, 0.167, 0.333, 0.5, 0.667, 0.833]);
  assert.equal(getPatternById("quintuplet").beats, 1);
  assert.equal(getPatternById("sextuplet").beats, 1);
});

test("level 71 tuplet-rest cards schedule the designed one-beat rhythms", () => {
  const quintupletRestFirst = scheduleChainEvents(["quintupletRestFirst"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => Number(event.beat.toFixed(3)));
  const quintupletRestMiddle = scheduleChainEvents(["quintupletRestMiddle"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => Number(event.beat.toFixed(3)));
  const sextupletRestMiddle = scheduleChainEvents(["sextupletRestMiddle"], { bpm: 96 })
    .filter((event) => event.audible)
    .map((event) => Number(event.beat.toFixed(3)));

  assert.deepEqual(quintupletRestFirst, [0.2, 0.4, 0.6, 0.8]);
  assert.deepEqual(quintupletRestMiddle, [0, 0.2, 0.6, 0.8]);
  assert.deepEqual(sextupletRestMiddle, [0, 0.167, 0.5, 0.667, 0.833]);
  assert.equal(getPatternById("quintupletRestFirst").beats, 1);
  assert.equal(getPatternById("quintupletRestMiddle").beats, 1);
  assert.equal(getPatternById("sextupletRestMiddle").beats, 1);
});

test("level 41-50 target chains blend advanced and earlier cards", () => {
  const advancedIds = new Set(["eighthRestTwoSixteenths", "dottedEighthSixteenth", "twoSixteenthsEighthRest"]);

  for (let levelNumber = 41; levelNumber <= 50; levelNumber += 1) {
    const chain = createTargetChain(getLevelConfig(levelNumber));
    const advancedCount = chain.filter((patternId) => advancedIds.has(patternId)).length;

    assert.equal(chain.length, 16);
    assert.ok(advancedCount >= 1, `level ${levelNumber} should include at least one new rhythm`);
    assert.ok(advancedCount <= 7, `level ${levelNumber} should keep older rhythms mixed in`);
  }
});

test("level 51-60 target chains blend challenge and earlier cards", () => {
  const challengeIds = new Set(["eighthTriplet", "tripletRestMiddle", "sixteenthRestDottedEighth"]);

  for (let levelNumber = 51; levelNumber <= 60; levelNumber += 1) {
    const chain = createTargetChain(getLevelConfig(levelNumber));
    const challengeCount = chain.filter((patternId) => challengeIds.has(patternId)).length;

    assert.equal(chain.length, 16);
    assert.ok(challengeCount >= 1, `level ${levelNumber} should include at least one page III rhythm`);
    assert.ok(challengeCount <= 7, `level ${levelNumber} should keep earlier rhythms mixed in`);
  }
});

test("level 61-70 target chains blend expert and earlier cards", () => {
  const expertIds = new Set(["quintuplet", "sextuplet"]);

  for (let levelNumber = 61; levelNumber <= 70; levelNumber += 1) {
    const chain = createTargetChain(getLevelConfig(levelNumber));
    const expertCount = chain.filter((patternId) => expertIds.has(patternId)).length;

    assert.equal(chain.length, 16);
    assert.ok(expertCount >= 1, `level ${levelNumber} should include at least one page IV rhythm`);
    assert.ok(expertCount <= 7, `level ${levelNumber} should keep earlier rhythms mixed in`);
  }
});

test("level 71-80 target chains blend master tuplet rests and earlier cards", () => {
  const masterIds = new Set(["quintupletRestFirst", "quintupletRestMiddle", "sextupletRestMiddle"]);

  for (let levelNumber = 71; levelNumber <= 80; levelNumber += 1) {
    const chain = createTargetChain(getLevelConfig(levelNumber));
    const masterCount = chain.filter((patternId) => masterIds.has(patternId)).length;

    assert.equal(chain.length, 16);
    assert.ok(masterCount >= 1, `level ${levelNumber} should include at least one page V rhythm`);
    assert.ok(masterCount <= 7, `level ${levelNumber} should keep earlier rhythms mixed in`);
  }
});

test("all generated target chains avoid removed tie and cross-beat cards", () => {
  const allowedIds = new Set(RHYTHM_PATTERNS.map((pattern) => pattern.id));
  const removedIds = new Set([
    "sixteenthDottedEighth",
    "dottedQuarterEighth",
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
