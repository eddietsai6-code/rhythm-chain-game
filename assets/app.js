import {
  DEFAULT_SOUND_ID,
  LEVEL_COUNT,
  SOUND_PRESETS,
  SPEED_OPTIONS,
  calculateChainBeats,
  createTapTempoTracker,
  createTargetChain,
  evaluatePlayerChain,
  getLevelConfig,
  getPatternById,
  getUnlockedPatterns,
  resolvePlaybackBpm,
  scheduleChainEvents,
} from "./rhythm-core.js";

const storageKey = "rhythm-chain-game-progress-v1";
const selectors = {
  levelTitle: document.querySelector("#levelTitle"),
  levelMeta: document.querySelector("#levelMeta"),
  comboReadout: document.querySelector("#comboReadout"),
  beatReadout: document.querySelector("#beatReadout"),
  accuracyReadout: document.querySelector("#accuracyReadout"),
  levelList: document.querySelector("#levelList"),
  targetChain: document.querySelector("#targetChain"),
  playerChain: document.querySelector("#playerChain"),
  targetBeatCount: document.querySelector("#targetBeatCount"),
  playerBeatCount: document.querySelector("#playerBeatCount"),
  statusText: document.querySelector("#statusText"),
  drillLabel: document.querySelector("#drillLabel"),
  libraryCount: document.querySelector("#libraryCount"),
  patternLibrary: document.querySelector("#patternLibrary"),
  playTargetButton: document.querySelector("#playTargetButton"),
  playPlayerButton: document.querySelector("#playPlayerButton"),
  checkButton: document.querySelector("#checkButton"),
  undoButton: document.querySelector("#undoButton"),
  clearButton: document.querySelector("#clearButton"),
  nextButton: document.querySelector("#nextButton"),
  previewDeckButton: document.querySelector("#previewDeckButton"),
  soundSelect: document.querySelector("#soundSelect"),
  speedSelect: document.querySelector("#speedSelect"),
  playControlButton: document.querySelector("#playControlButton"),
  tapButton: document.querySelector("#tapButton"),
  tapTempoLabel: document.querySelector("#tapTempoLabel"),
};

const progress = loadProgress();
const state = {
  level: progress.currentLevel,
  targetChain: [],
  playerChain: [],
  soundId: resolveSoundId(progress.soundId),
  speedId: resolveSpeedId(progress.speedId),
  tapTracker: createTapTempoTracker({ windowSize: 4 }),
  tapBpm: null,
  activeTargetIndex: null,
  activePlayerIndex: null,
  mismatches: new Set(),
  lastResult: null,
  playbackTimers: [],
  audioNodes: [],
  audioContext: null,
};

function init() {
  renderControls();
  bindControls();
  loadLevel(state.level);
}

function renderControls() {
  selectors.soundSelect.replaceChildren(
    ...SOUND_PRESETS.map((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      return option;
    })
  );
  selectors.soundSelect.value = state.soundId;

  selectors.speedSelect.replaceChildren(
    ...SPEED_OPTIONS.map((optionConfig) => {
      const option = document.createElement("option");
      option.value = optionConfig.id;
      option.textContent = optionConfig.label;
      return option;
    })
  );
  selectors.speedSelect.value = state.speedId;
}

function bindControls() {
  selectors.soundSelect.addEventListener("change", handleSoundChange);
  selectors.speedSelect.addEventListener("change", handleSpeedChange);
  selectors.playControlButton.addEventListener("click", () => playChain("target"));
  selectors.tapButton.addEventListener("click", handleTap);
  selectors.playTargetButton.addEventListener("click", () => playChain("target"));
  selectors.playPlayerButton.addEventListener("click", () => playChain("player"));
  selectors.checkButton.addEventListener("click", checkPlayerChain);
  selectors.undoButton.addEventListener("click", undoLastCard);
  selectors.clearButton.addEventListener("click", clearPlayerChain);
  selectors.nextButton.addEventListener("click", () => loadLevel(Math.min(LEVEL_COUNT, state.level + 1)));
  selectors.previewDeckButton.addEventListener("click", previewDeck);
}

async function handleSoundChange() {
  state.soundId = resolveSoundId(selectors.soundSelect.value);
  progress.soundId = state.soundId;
  saveProgress();
  await playTapSound();
  setStatus(`音效: ${getSoundPreset(state.soundId).label}`, "idle");
}

function handleSpeedChange() {
  state.speedId = resolveSpeedId(selectors.speedSelect.value);
  progress.speedId = state.speedId;
  saveProgress();
  renderReadouts();
  setStatus(`速度: ${getSpeedOption(state.speedId).label}`, "idle");
}

async function handleTap() {
  const bpm = state.tapTracker.tap(performance.now());
  await playTapSound();

  if (bpm) {
    state.tapBpm = bpm;
    selectors.tapTempoLabel.textContent = `${bpm} BPM`;
    renderReadouts();
    setStatus(`TAP: ${bpm} BPM`, "playing");
    return;
  }

  selectors.tapTempoLabel.textContent = "-- BPM";
  setStatus("TAP", "playing");
}

function loadLevel(levelNumber) {
  clearPlayback();
  state.level = Math.min(LEVEL_COUNT, Math.max(1, Number(levelNumber) || 1));
  state.config = getLevelConfig(state.level);
  state.targetChain = createTargetChain(state.config);
  state.playerChain = [];
  state.tapBpm = null;
  state.tapTracker.reset();
  selectors.tapTempoLabel.textContent = "-- BPM";
  state.activeTargetIndex = null;
  state.activePlayerIndex = null;
  state.mismatches = new Set();
  state.lastResult = null;
  progress.currentLevel = state.level;
  saveProgress();
  render();
  setStatus("准备", "idle");
}

function render() {
  renderLevelList();
  renderReadouts();
  renderChain(selectors.targetChain, state.targetChain, "target");
  renderPlayerChain();
  renderLibrary();
}

function renderLevelList() {
  selectors.levelList.replaceChildren(
    ...Array.from({ length: LEVEL_COUNT }, (_, index) => {
      const level = index + 1;
      const button = document.createElement("button");
      button.className = "level-button";
      button.type = "button";
      button.textContent = String(level);
      button.setAttribute("aria-label", `关卡 ${level}`);
      if (level === state.level) button.classList.add("active");
      if (progress.passedLevels.includes(level)) button.classList.add("passed");
      button.addEventListener("click", () => loadLevel(level));
      return button;
    })
  );
}

function renderReadouts() {
  const targetBeats = calculateChainBeats(state.targetChain);
  const playerBeats = calculateChainBeats(state.playerChain);
  const accuracy = state.lastResult ? `${Math.round(state.lastResult.accuracy * 100)}%` : "0%";
  const bpm = getPlaybackBpm();

  selectors.levelTitle.textContent = `第 ${state.level} / ${LEVEL_COUNT} 关`;
  selectors.levelMeta.textContent = `${state.config.comboCount} 组合 / ${bpm} BPM`;
  selectors.comboReadout.textContent = `${state.playerChain.length} / ${state.config.comboCount}`;
  selectors.beatReadout.textContent = String(targetBeats);
  selectors.accuracyReadout.textContent = accuracy;
  selectors.targetBeatCount.textContent = `${targetBeats} 拍`;
  selectors.playerBeatCount.textContent = `${playerBeats} 拍`;
  selectors.drillLabel.textContent = `关卡 ${state.level}`;
}

function renderChain(container, chain, role) {
  container.replaceChildren(
    ...chain.map((patternId, index) => {
      const pattern = getPatternById(patternId);
      const tile = createPatternTile(pattern, {
        compact: true,
        index,
        active: role === "target" ? state.activeTargetIndex === index : state.activePlayerIndex === index,
      });
      tile.classList.add(`${role}-tile`);
      tile.type = "button";

      if (role === "target") {
        tile.title = "试听这个节奏";
        tile.addEventListener("click", () => playPreview(pattern.id));
      }

      return tile;
    })
  );
}

function renderPlayerChain() {
  const slots = Array.from({ length: state.config.comboCount }, (_, index) => {
    const patternId = state.playerChain[index];
    if (!patternId) {
      const empty = document.createElement("button");
      empty.className = "empty-slot";
      empty.type = "button";
      empty.textContent = "+";
      empty.title = `Slot ${index + 1}`;
      empty.addEventListener("click", () => {
        const targetPattern = state.targetChain[index] || state.targetChain[state.playerChain.length];
        if (targetPattern) addPattern(targetPattern);
      });
      return empty;
    }

    const tile = createPatternTile(getPatternById(patternId), {
      compact: true,
      index,
      active: state.activePlayerIndex === index,
    });
    tile.classList.add("player-tile");
    if (state.mismatches.has(index)) tile.classList.add("mismatch");
    tile.title = "移除这个节奏";
    tile.addEventListener("click", () => {
      state.playerChain.splice(index, 1);
      state.lastResult = null;
      state.mismatches = new Set();
      render();
    });
    return tile;
  });

  selectors.playerChain.replaceChildren(...slots);
  renderReadouts();
}

function renderLibrary() {
  const unlockedPatterns = getUnlockedPatterns(state.config);
  selectors.libraryCount.textContent = String(unlockedPatterns.length);
  selectors.patternLibrary.replaceChildren(
    ...unlockedPatterns.map((pattern) => {
      const tile = createPatternTile(pattern, { compact: false });
      tile.addEventListener("click", () => addPattern(pattern.id));
      tile.disabled = state.playerChain.length >= state.config.comboCount;
      return tile;
    })
  );
}

function createPatternTile(pattern, options = {}) {
  const button = document.createElement("button");
  button.className = `rhythm-card color-${pattern.color}`;
  button.type = "button";
  button.dataset.patternId = pattern.id;
  button.setAttribute("aria-label", pattern.name);
  if (options.active) button.classList.add("active");
  if (options.compact) button.classList.add("compact");
  if (pattern.beats > 1) button.classList.add("wide-rhythm");

  const number = document.createElement("span");
  number.className = "combo-number";
  number.textContent = Number.isInteger(options.index) ? String(options.index + 1) : `${pattern.beats} beat`;

  const symbol = document.createElement("span");
  symbol.className = "note-symbol";
  symbol.textContent = pattern.symbol;

  const label = document.createElement("span");
  label.className = "card-label";
  label.textContent = pattern.name;

  const syllables = document.createElement("span");
  syllables.className = "syllables";
  syllables.textContent = pattern.syllables;

  button.append(number, symbol, label, syllables);
  return button;
}

function addPattern(patternId) {
  if (state.playerChain.length >= state.config.comboCount) {
    setStatus("链条已满", "warn");
    return;
  }

  state.playerChain.push(patternId);
  state.lastResult = null;
  state.mismatches = new Set();
  playPreview(patternId);
  render();
  setStatus(`${state.playerChain.length} / ${state.config.comboCount}`, "idle");
}

function undoLastCard() {
  state.playerChain.pop();
  state.lastResult = null;
  state.mismatches = new Set();
  render();
  setStatus("撤销", "idle");
}

function clearPlayerChain() {
  state.playerChain = [];
  state.lastResult = null;
  state.mismatches = new Set();
  clearPlayback();
  render();
  setStatus("已清空", "idle");
}

function checkPlayerChain() {
  const result = evaluatePlayerChain(state.targetChain, state.playerChain);
  state.lastResult = result;
  state.mismatches = new Set(result.mismatches.map((item) => item.index));

  if (result.passed) {
    if (!progress.passedLevels.includes(state.level)) {
      progress.passedLevels.push(state.level);
      progress.passedLevels.sort((first, second) => first - second);
    }
    saveProgress();
    setStatus(`通过: 关卡 ${state.level}`, "success");
  } else if (state.playerChain.length < state.targetChain.length) {
    setStatus(`还差 ${state.targetChain.length - state.playerChain.length} 个`, "warn");
  } else {
    setStatus(`${result.matched} / ${result.total} 匹配`, "warn");
  }

  render();
}

async function playChain(kind) {
  const chain = kind === "target" ? state.targetChain : state.playerChain;
  if (chain.length === 0) {
    setStatus("没有内容", "warn");
    return;
  }

  clearPlayback();
  const audioContext = await getAudioContext();
  const startTime = audioContext.currentTime + 0.08;
  const events = scheduleChainEvents(chain, {
    bpm: getPlaybackBpm(),
    startTime,
  });

  events.forEach((event) => scheduleAudioEvent(audioContext, event));
  scheduleHighlights(events, kind, startTime);
  setStatus(kind === "target" ? "正在播放目标" : "正在播放链条", "playing");
}

async function playPreview(patternId) {
  const audioContext = await getAudioContext();
  const startTime = audioContext.currentTime + 0.02;
  scheduleChainEvents([patternId], { bpm: getPlaybackBpm(), startTime }).forEach((event) =>
    scheduleAudioEvent(audioContext, event)
  );
}

async function previewDeck() {
  const deckChain = getUnlockedPatterns(state.config).map((pattern) => pattern.id);
  if (deckChain.length === 0) return;

  clearPlayback();
  const audioContext = await getAudioContext();
  const startTime = audioContext.currentTime + 0.08;
  const shortBpm = resolvePlaybackBpm(Math.min(138, state.config.bpm + 18), getSpeedOption(state.speedId).multiplier);
  const events = scheduleChainEvents(deckChain, {
    bpm: shortBpm,
    startTime,
  });
  events.forEach((event) => scheduleAudioEvent(audioContext, event));
  scheduleHighlights(events, "deck", startTime);
  setStatus("试听音效", "playing");
}

async function playTapSound() {
  try {
    const audioContext = await getAudioContext();
    playSoundPreset(audioContext, state.soundId, {
      start: audioContext.currentTime + 0.01,
      duration: 0.08,
      velocity: 0.95,
      accent: true,
    });
  } catch {
    // getAudioContext already reports the browser audio issue in the UI.
  }
}

async function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setStatus("浏览器不支持音频", "warn");
    throw new Error("Web Audio unavailable");
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }

  return state.audioContext;
}

function scheduleAudioEvent(audioContext, event) {
  if (!event.audible) return;

  playSoundPreset(audioContext, state.soundId, {
    start: event.timeSeconds,
    duration: event.kind === "pulse" ? 0.045 : event.durationSeconds,
    velocity: event.kind === "pulse" ? event.velocity * 0.55 : event.velocity,
    accent: event.kind === "note",
  });
}

function playSoundPreset(audioContext, soundId, options) {
  switch (resolveSoundId(soundId)) {
    case "kick":
      playKick(audioContext, options);
      break;
    case "closedHat":
      playClosedHat(audioContext, options);
      break;
    case "clap":
      playClap(audioContext, options);
      break;
    case "woodblock":
      playWoodblock(audioContext, options);
      break;
    case "snare":
    default:
      playSnare(audioContext, options);
      break;
  }
}

function playSnare(audioContext, options) {
  const duration = Math.max(0.045, Math.min(0.16, options.duration));
  const noise = audioContext.createBufferSource();
  const noiseFilter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  const body = audioContext.createOscillator();
  const bodyGain = audioContext.createGain();
  const buffer = createNoiseBuffer(audioContext, duration);

  noise.buffer = buffer;
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(options.accent ? 2400 : 1800, options.start);
  noiseFilter.Q.setValueAtTime(0.85, options.start);
  noiseGain.gain.setValueAtTime(0.0001, options.start);
  noiseGain.gain.exponentialRampToValueAtTime(0.16 * options.velocity, options.start + 0.006);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, options.start + duration);

  body.type = "triangle";
  body.frequency.setValueAtTime(options.accent ? 205 : 175, options.start);
  body.frequency.exponentialRampToValueAtTime(125, options.start + duration);
  bodyGain.gain.setValueAtTime(0.0001, options.start);
  bodyGain.gain.exponentialRampToValueAtTime(0.07 * options.velocity, options.start + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, options.start + duration * 0.72);

  noise.connect(noiseFilter).connect(noiseGain).connect(audioContext.destination);
  body.connect(bodyGain).connect(audioContext.destination);
  startAndTrack(noise, options.start, duration + 0.02);
  startAndTrack(body, options.start, duration + 0.02);
}

function playKick(audioContext, options) {
  const duration = Math.max(0.11, Math.min(0.22, options.duration * 1.6));
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(142, options.start);
  oscillator.frequency.exponentialRampToValueAtTime(48, options.start + duration);
  gain.gain.setValueAtTime(0.0001, options.start);
  gain.gain.exponentialRampToValueAtTime(0.42 * options.velocity, options.start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.start + duration);

  oscillator.connect(gain).connect(audioContext.destination);
  startAndTrack(oscillator, options.start, duration + 0.02);
}

function playClosedHat(audioContext, options) {
  const duration = Math.max(0.035, Math.min(0.08, options.duration));
  const noise = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  noise.buffer = createNoiseBuffer(audioContext, duration);
  filter.type = "highpass";
  filter.frequency.setValueAtTime(6800, options.start);
  gain.gain.setValueAtTime(0.0001, options.start);
  gain.gain.exponentialRampToValueAtTime(0.11 * options.velocity, options.start + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.start + duration);

  noise.connect(filter).connect(gain).connect(audioContext.destination);
  startAndTrack(noise, options.start, duration + 0.01);
}

function playClap(audioContext, options) {
  [0, 0.018, 0.037].forEach((delay, index) => {
    const duration = 0.055 + index * 0.012;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    const start = options.start + delay;

    source.buffer = createNoiseBuffer(audioContext, duration);
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1700 + index * 420, start);
    filter.Q.setValueAtTime(0.75, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.1 * options.velocity, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(gain).connect(audioContext.destination);
    startAndTrack(source, start, duration + 0.01);
  });
}

function playWoodblock(audioContext, options) {
  const duration = Math.max(0.04, Math.min(0.11, options.duration));
  [860, 1240].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, options.start);
    gain.gain.setValueAtTime(0.0001, options.start);
    gain.gain.exponentialRampToValueAtTime((index === 0 ? 0.085 : 0.04) * options.velocity, options.start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.start + duration);

    oscillator.connect(gain).connect(audioContext.destination);
    startAndTrack(oscillator, options.start, duration + 0.015);
  });
}

function createNoiseBuffer(audioContext, duration) {
  const sampleCount = Math.ceil(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

  return buffer;
}

function startAndTrack(node, start, duration) {
  node.start(start);
  node.stop(start + duration);
  state.audioNodes.push(node);
  node.addEventListener("ended", () => {
    state.audioNodes = state.audioNodes.filter((audioNode) => audioNode !== node);
  });
}

function scheduleHighlights(events, kind, startTime) {
  const audioContext = state.audioContext;
  const firstEventByCombo = new Map();
  events.forEach((event) => {
    if (!firstEventByCombo.has(event.comboIndex)) {
      firstEventByCombo.set(event.comboIndex, event);
    }
  });

  firstEventByCombo.forEach((event) => {
    const delay = Math.max(0, (event.timeSeconds - audioContext.currentTime) * 1000);
    state.playbackTimers.push(
      window.setTimeout(() => {
        if (kind === "target") {
          state.activeTargetIndex = event.comboIndex;
          state.activePlayerIndex = null;
          renderChain(selectors.targetChain, state.targetChain, "target");
        } else if (kind === "player") {
          state.activePlayerIndex = event.comboIndex;
          state.activeTargetIndex = null;
          renderPlayerChain();
        } else {
          highlightDeckCard(event.patternId);
        }
      }, delay)
    );
  });

  const lastEvent = events.at(-1);
  const endDelay = Math.max(0, (lastEvent.timeSeconds - startTime) * 1000 + 900);
  state.playbackTimers.push(
    window.setTimeout(() => {
      state.activeTargetIndex = null;
      state.activePlayerIndex = null;
      renderChain(selectors.targetChain, state.targetChain, "target");
      renderPlayerChain();
      clearDeckHighlight();
      setStatus("准备", "idle");
    }, endDelay)
  );
}

function highlightDeckCard(patternId) {
  clearDeckHighlight();
  const card = selectors.patternLibrary.querySelector(`[data-pattern-id="${patternId}"]`);
  if (card) card.classList.add("active");
}

function clearDeckHighlight() {
  selectors.patternLibrary.querySelectorAll(".active").forEach((card) => card.classList.remove("active"));
}

function clearPlayback() {
  state.playbackTimers.forEach((timer) => window.clearTimeout(timer));
  state.playbackTimers = [];
  state.audioNodes.forEach((node) => {
    try {
      node.stop();
    } catch {
      // Already ended.
    }
  });
  state.audioNodes = [];
  state.activeTargetIndex = null;
  state.activePlayerIndex = null;
  clearDeckHighlight();
}

function setStatus(message, variant) {
  selectors.statusText.textContent = message;
  selectors.statusText.dataset.variant = variant;
}

function getPlaybackBpm() {
  const baseBpm = state.tapBpm || state.config.bpm;
  return resolvePlaybackBpm(baseBpm, getSpeedOption(state.speedId).multiplier);
}

function getSoundPreset(soundId) {
  return SOUND_PRESETS.find((preset) => preset.id === soundId) || SOUND_PRESETS[0];
}

function getSpeedOption(speedId) {
  return SPEED_OPTIONS.find((option) => option.id === speedId) || SPEED_OPTIONS[1];
}

function resolveSoundId(soundId) {
  return SOUND_PRESETS.some((preset) => preset.id === soundId) ? soundId : DEFAULT_SOUND_ID;
}

function resolveSpeedId(speedId) {
  return SPEED_OPTIONS.some((option) => option.id === speedId) ? speedId : "normal";
}

function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return {
      currentLevel: parsed.currentLevel || 1,
      passedLevels: Array.isArray(parsed.passedLevels) ? parsed.passedLevels : [],
      soundId: resolveSoundId(parsed.soundId),
      speedId: resolveSpeedId(parsed.speedId),
    };
  } catch {
    return { currentLevel: 1, passedLevels: [], soundId: DEFAULT_SOUND_ID, speedId: "normal" };
  }
}

function saveProgress() {
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      currentLevel: state.level,
      passedLevels: progress.passedLevels,
      soundId: state.soundId,
      speedId: state.speedId,
    })
  );
}

init();
