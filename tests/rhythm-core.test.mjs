import test from "node:test";
import assert from "node:assert/strict";

import {
  LEVEL_COUNT,
  SNARE_TONE,
  RHYTHM_PATTERNS,
  buildLevels,
  calculateChainBeats,
  createTargetChain,
  evaluatePlayerChain,
  getLevelConfig,
  getPatternById,
  getUnlockedPatterns,
  scheduleChainEvents,
} from "../assets/rhythm-core.js";

test("buildLevels creates 30 levels that grow from 4 to 16 rhythm combinations", () => {
  const levels = buildLevels();

  assert.equal(LEVEL_COUNT, 30);
  assert.equal(levels.length, 30);
  assert.equal(levels[0].comboCount, 4);
  assert.equal(levels.at(-1).comboCount, 16);

  for (let index = 1; index < levels.length; index += 1) {
    assert.ok(levels[index].comboCount >= levels[index - 1].comboCount);
  }
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

test("every combo slot schedules an audible beat pulse before inner rhythm sounds", () => {
  const chain = ["quarterRest", "twoEighths", "triplet", "syncopatedTie"];
  const events = scheduleChainEvents(chain, { bpm: 96 });
  const expectedBeatStarts = Array.from({ length: calculateChainBeats(chain) }, (_, index) => index);
  const audibleBeatStarts = new Set(
    events
      .filter((event) => event.kind === "pulse" && event.audible)
      .map((event) => event.beat)
  );

  assert.deepEqual([...audibleBeatStarts], expectedBeatStarts);
  assert.ok(events.some((event) => event.kind === "note" && event.patternId === "triplet"));
  assert.ok(events.every((event) => Number.isFinite(event.timeSeconds)));
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
