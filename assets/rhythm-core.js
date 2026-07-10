export const LEVEL_COUNT = 40;
export const SNARE_TONE = "snare";
export const DEFAULT_SOUND_ID = SNARE_TONE;
export const SOUND_PRESETS = deepFreeze([
  { id: SNARE_TONE, label: "军鼓", shortLabel: "Snare" },
  { id: "kick", label: "底鼓", shortLabel: "Kick" },
  { id: "closedHat", label: "踩镲", shortLabel: "Hat" },
  { id: "clap", label: "拍手", shortLabel: "Clap" },
  { id: "woodblock", label: "木鱼", shortLabel: "Wood" },
]);
export const DRUM_KIT_TONES = deepFreeze([
  ...SOUND_PRESETS.map((preset) => preset.id),
]);
export const SPEED_OPTIONS = deepFreeze([
  { id: "slow", label: "慢速", multiplier: 0.75 },
  { id: "normal", label: "原速", multiplier: 1 },
  { id: "fast", label: "快速", multiplier: 1.25 },
  { id: "challenge", label: "挑战", multiplier: 1.5 },
]);
const MIN_COMBO_COUNT = 4;
const MAX_COMBO_COUNT = 16;
const DEFAULT_BPM = 80;
export const COUNT_IN_BEATS = 4;

function deepFreeze(value) {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
  }

  return Object.freeze(value);
}

function hit(at, tone = "stick", velocity = 0.82, duration = 0.08) {
  return { at, tone, velocity, duration };
}

const PATTERN_DEFINITIONS = [
  {
    id: "quarter",
    label: "Quarter",
    name: "四分音符",
    symbol: "♩",
    family: "basic",
    color: "red",
    unlockLevel: 1,
    difficulty: 1,
    beats: 1,
    syllables: "TA",
    description: "One clear hit on the beat.",
    hits: [hit(0, "kick", 0.92, 0.16)],
  },
  {
    id: "twoEighths",
    label: "Two eighths",
    name: "两个八分音符",
    symbol: "♫",
    family: "basic",
    color: "green",
    unlockLevel: 1,
    difficulty: 1,
    beats: 1,
    syllables: "TA-KA",
    description: "Two even sounds inside one beat.",
    hits: [hit(0), hit(0.5, "wood", 0.72)],
  },
  {
    id: "quarterRest",
    label: "Quarter rest",
    name: "四分休止",
    symbol: "𝄽",
    family: "rests",
    color: "black",
    unlockLevel: 1,
    difficulty: 1,
    beats: 1,
    syllables: "shh",
    description: "A silent rhythm card; the beat pulse still sounds.",
    hits: [],
  },
  {
    id: "eighthRestEighth",
    label: "Eighth rest + eighth",
    name: "八分休止后八分",
    symbol: "𝄾♪",
    family: "rests",
    color: "silver",
    unlockLevel: 1,
    difficulty: 2,
    beats: 1,
    syllables: "shh-KA",
    description: "Wait for the offbeat, then play.",
    hits: [hit(0.5, "wood", 0.84)],
  },
  {
    id: "eighthEighthRest",
    label: "Eighth + eighth rest",
    name: "八分后八分休止",
    symbol: "♪𝄾",
    family: "rests",
    color: "silver",
    unlockLevel: 4,
    difficulty: 2,
    beats: 1,
    syllables: "TA-shh",
    description: "Play first, leave the offbeat empty.",
    hits: [hit(0, "wood", 0.84)],
  },
  {
    id: "fourSixteenths",
    label: "Four sixteenths",
    name: "四个十六分音符",
    symbol: "♬♬",
    glyph: "four-sixteenth-run",
    family: "division",
    color: "blue",
    unlockLevel: 7,
    difficulty: 3,
    beats: 1,
    syllables: "TA-KA-DI-MI",
    description: "Four fast, even subdivisions.",
    hits: [hit(0), hit(0.25, "wood", 0.7), hit(0.5, "stick", 0.74), hit(0.75, "wood", 0.68)],
  },
  {
    id: "twoSixteenthsEighth",
    label: "Two sixteenths + eighth",
    name: "十六十六八",
    symbol: "♬♪",
    glyph: "two-sixteenths-eighth",
    family: "division",
    color: "blue",
    unlockLevel: 16,
    difficulty: 4,
    beats: 1,
    syllables: "TA-KA-DI",
    description: "Quick start, then a longer second half.",
    hits: [hit(0), hit(0.25, "wood", 0.72), hit(0.5, "stick", 0.82, 0.14)],
  },
  {
    id: "eighthTwoSixteenths",
    label: "Eighth + two sixteenths",
    name: "八十六十六",
    symbol: "♪♬",
    glyph: "eighth-two-sixteenths",
    family: "division",
    color: "green",
    unlockLevel: 11,
    difficulty: 3,
    beats: 1,
    syllables: "TA-DI-MI",
    description: "A held first half followed by two faster notes.",
    hits: [hit(0, "stick", 0.84, 0.14), hit(0.5, "wood", 0.72), hit(0.75, "stick", 0.74)],
  },
  {
    id: "sixteenthEighthSixteenth",
    label: "Sixteenth + eighth + sixteenth",
    name: "十六八十六切分",
    symbol: "♬♪",
    glyph: "sixteenth-eighth-sixteenth",
    family: "syncopation",
    color: "gold",
    unlockLevel: 31,
    difficulty: 5,
    beats: 1,
    syllables: "TA-KA-MI",
    description: "A one-beat syncopation with a longer middle sound.",
    hits: [hit(0, "stick", 0.84), hit(0.25, "wood", 0.86, 0.14), hit(0.75, "stick", 0.78)],
  },
  {
    id: "sixteenthRestThreeSixteenths",
    label: "Sixteenth rest + three sixteenths",
    name: "十六休止后三个十六",
    symbol: "𝄿♬",
    glyph: "sixteenth-rest-three-sixteenths",
    family: "syncopation",
    color: "orange",
    unlockLevel: 31,
    difficulty: 5,
    beats: 1,
    syllables: "shh-KA-DI-MI",
    description: "Rest on the beat, then play the remaining three sixteenth subdivisions.",
    hits: [hit(0.25, "wood", 0.78), hit(0.5, "stick", 0.84), hit(0.75, "wood", 0.76)],
  },
];

const THEORY_SAFE_PATTERN_ORDER = [
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
];

export const RHYTHM_PATTERNS = deepFreeze(
  THEORY_SAFE_PATTERN_ORDER.map((patternId) => {
    const pattern = PATTERN_DEFINITIONS.find((definition) => definition.id === patternId);
    if (!pattern) {
      throw new Error(`Missing rhythm pattern: ${patternId}`);
    }

    return { ...pattern };
  })
);
const PATTERN_BY_ID = new Map(RHYTHM_PATTERNS.map((pattern) => [pattern.id, pattern]));
const LEVELS = deepFreeze(createLevels());

export function buildLevels() {
  return LEVELS.map((level) => ({ ...level }));
}

export function getLevelConfig(levelNumber) {
  const level = Math.min(LEVEL_COUNT, Math.max(1, Math.trunc(Number(levelNumber) || 1)));
  return { ...LEVELS[level - 1] };
}

export function getUnlockedPatterns(levelOrConfig) {
  const level = typeof levelOrConfig === "object" ? levelOrConfig.level : levelOrConfig;
  const levelNumber = getLevelConfig(level).level;

  return RHYTHM_PATTERNS.filter((pattern) => pattern.unlockLevel <= levelNumber);
}

export function createTargetChain(levelConfig, options = {}) {
  const config = typeof levelConfig === "number" ? getLevelConfig(levelConfig) : levelConfig;
  const pool = getUnlockedPatterns(config).filter(
    (pattern) => pattern.difficulty <= config.maxPatternDifficulty
  );
  const random = options.random || seededRandom(config.seed);
  const chain = [];

  for (let index = 0; index < config.comboCount; index += 1) {
    const previousPattern = chain.length > 0 ? getPatternById(chain.at(-1)) : null;
    const filteredPool =
      previousPattern?.family === "rests"
        ? pool.filter((pattern) => pattern.family !== "rests")
        : pool;
    const selected = chooseWeightedPattern(filteredPool, random, config.level, index);
    chain.push(selected.id);
  }

  return chain;
}

export function scheduleChainEvents(chain, options = {}) {
  const bpm = Number(options.bpm) > 0 ? Number(options.bpm) : DEFAULT_BPM;
  const startTime = Number(options.startTime) || 0;
  const beatDuration = 60 / bpm;
  const events = [];
  let beatCursor = 0;

  chain.forEach((patternId, comboIndex) => {
    const pattern = getPatternById(patternId);

    for (let beatOffset = 0; beatOffset < pattern.beats; beatOffset += 1) {
      const beat = beatCursor + beatOffset;
      events.push({
        kind: "pulse",
        audible: false,
        patternId,
        comboIndex,
        beat,
        timeSeconds: startTime + beat * beatDuration,
        durationSeconds: Math.min(0.055, beatDuration * 0.12),
        velocity: beatOffset === 0 ? 0.42 : 0.34,
        tone: SNARE_TONE,
      });
    }

    pattern.hits.forEach((patternHit) => {
      const beat = beatCursor + patternHit.at;
      events.push({
        kind: "note",
        audible: true,
        patternId,
        comboIndex,
        beat,
        timeSeconds: startTime + beat * beatDuration,
        durationSeconds: Math.max(0.035, patternHit.duration * beatDuration),
        velocity: patternHit.velocity,
        tone: normalizeDrumTone(patternHit.tone, pattern, patternHit.at),
      });
    });

    beatCursor += pattern.beats;
  });

  return events.sort((first, second) => {
    if (first.timeSeconds !== second.timeSeconds) {
      return first.timeSeconds - second.timeSeconds;
    }
    if (first.kind === second.kind) {
      return 0;
    }
    return first.kind === "pulse" ? -1 : 1;
  });
}

export function scheduleCountInEvents(options = {}) {
  const bpm = Number(options.bpm) > 0 ? Number(options.bpm) : DEFAULT_BPM;
  const startTime = Number(options.startTime) || 0;
  const beatDuration = 60 / bpm;

  return Array.from({ length: COUNT_IN_BEATS }, (_, countIndex) => ({
    kind: "countIn",
    audible: true,
    countIndex,
    beat: countIndex,
    timeSeconds: startTime + countIndex * beatDuration,
    durationSeconds: Math.min(0.08, beatDuration * 0.16),
    velocity: countIndex === COUNT_IN_BEATS - 1 ? 0.96 : 0.72,
    accent: countIndex === COUNT_IN_BEATS - 1,
    tone: SNARE_TONE,
  }));
}

export function resolvePlaybackBpm(baseBpm, speedMultiplier = 1) {
  const base = Number(baseBpm) > 0 ? Number(baseBpm) : DEFAULT_BPM;
  const multiplier = Number(speedMultiplier);
  const safeMultiplier = Number.isFinite(multiplier) ? Math.min(2, Math.max(0.5, multiplier)) : 1;

  return Math.round(base * safeMultiplier);
}

export function createTapTempoTracker(options = {}) {
  const windowSize = Math.max(2, Math.trunc(Number(options.windowSize) || 4));
  const resetAfterMs = Number(options.resetAfterMs) > 0 ? Number(options.resetAfterMs) : 2000;
  let taps = [];

  return {
    tap(timeMs = Date.now()) {
      const time = Number(timeMs);
      if (!Number.isFinite(time)) return null;

      if (taps.length > 0 && time - taps.at(-1) > resetAfterMs) {
        taps = [];
      }

      taps.push(time);
      if (taps.length > windowSize) taps = taps.slice(-windowSize);
      if (taps.length < 2) return null;

      const intervals = [];
      for (let index = 1; index < taps.length; index += 1) {
        const interval = taps[index] - taps[index - 1];
        if (interval <= 0) return null;
        intervals.push(interval);
      }

      const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      return Math.round(60000 / averageInterval);
    },
    reset() {
      taps = [];
    },
    get count() {
      return taps.length;
    },
  };
}

export function getPatternById(patternId) {
  const pattern = PATTERN_BY_ID.get(patternId);
  if (!pattern) {
    throw new Error(`Unknown rhythm pattern: ${patternId}`);
  }

  return pattern;
}

export function calculateChainBeats(chain) {
  return chain.reduce((total, patternId) => total + getPatternById(patternId).beats, 0);
}

export function evaluatePlayerChain(targetChain, playerChain) {
  const total = targetChain.length;
  const mismatches = [];
  let matched = 0;

  for (let index = 0; index < total; index += 1) {
    const expected = targetChain[index];
    const actual = playerChain[index] ?? null;

    if (actual === expected) {
      matched += 1;
    } else {
      mismatches.push({ index, expected, actual });
    }
  }

  return {
    passed: mismatches.length === 0 && playerChain.length === targetChain.length,
    matched,
    total,
    accuracy: total === 0 ? 1 : Number((matched / total).toFixed(3)),
    mismatches,
  };
}

function normalizeDrumTone(tone, pattern, at) {
  return SNARE_TONE;
}

export function getComboCountForLevel(levelNumber) {
  if (levelNumber >= 21) return MAX_COMBO_COUNT;
  if (levelNumber >= 11) return 8;
  return MIN_COMBO_COUNT;
}

function createLevels() {
  return Array.from({ length: LEVEL_COUNT }, (_, index) => {
    const level = index + 1;
    const comboCount = getComboCountForLevel(level);
    return {
      level,
      comboCount,
      bpm: DEFAULT_BPM,
      maxPatternDifficulty: Math.min(9, 1 + Math.floor(index / 3)),
      targetStars: Math.max(6, comboCount + Math.floor(level / 5)),
      seed: 9137 + level * 7919,
    };
  });
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function chooseWeightedPattern(pool, random, level, comboIndex) {
  const weighted = pool.map((pattern) => {
    const lateUnlockBoost = Math.max(0, level - pattern.unlockLevel) * 0.04;
    const complexityNudge = comboIndex % 4 === 3 ? pattern.difficulty * 0.08 : 0;
    const weight = 1 + lateUnlockBoost + complexityNudge;
    return { pattern, weight };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * totalWeight;

  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.pattern;
    }
  }

  return weighted.at(-1).pattern;
}
