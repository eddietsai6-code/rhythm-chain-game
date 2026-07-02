import {
  LEVEL_COUNT,
  calculateChainBeats,
  createTargetChain,
  evaluatePlayerChain,
  getLevelConfig,
  getPatternById,
  getUnlockedPatterns,
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
};

const progress = loadProgress();
const state = {
  level: progress.currentLevel,
  targetChain: [],
  playerChain: [],
  activeTargetIndex: null,
  activePlayerIndex: null,
  mismatches: new Set(),
  lastResult: null,
  playbackTimers: [],
  audioNodes: [],
  audioContext: null,
};

function init() {
  bindControls();
  loadLevel(state.level);
}

function bindControls() {
  selectors.playTargetButton.addEventListener("click", () => playChain("target"));
  selectors.playPlayerButton.addEventListener("click", () => playChain("player"));
  selectors.checkButton.addEventListener("click", checkPlayerChain);
  selectors.undoButton.addEventListener("click", undoLastCard);
  selectors.clearButton.addEventListener("click", clearPlayerChain);
  selectors.nextButton.addEventListener("click", () => loadLevel(Math.min(LEVEL_COUNT, state.level + 1)));
  selectors.previewDeckButton.addEventListener("click", previewDeck);
}

function loadLevel(levelNumber) {
  clearPlayback();
  state.level = Math.min(LEVEL_COUNT, Math.max(1, Number(levelNumber) || 1));
  state.config = getLevelConfig(state.level);
  state.targetChain = createTargetChain(state.config);
  state.playerChain = [];
  state.activeTargetIndex = null;
  state.activePlayerIndex = null;
  state.mismatches = new Set();
  state.lastResult = null;
  progress.currentLevel = state.level;
  saveProgress();
  render();
  setStatus("Ready", "idle");
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
      button.setAttribute("aria-label", `Drill ${level}`);
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

  selectors.levelTitle.textContent = `Level ${state.level} / ${LEVEL_COUNT}`;
  selectors.levelMeta.textContent = `${state.config.comboCount} combos · ${state.config.bpm} BPM`;
  selectors.comboReadout.textContent = `${state.playerChain.length} / ${state.config.comboCount}`;
  selectors.beatReadout.textContent = String(targetBeats);
  selectors.accuracyReadout.textContent = accuracy;
  selectors.targetBeatCount.textContent = `${targetBeats} beats`;
  selectors.playerBeatCount.textContent = `${playerBeats} beats`;
  selectors.drillLabel.textContent = `Drill ${state.level}`;
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
      tile.disabled = role === "target";
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
      empty.addEventListener("click", () => focusLibrary());
      return empty;
    }

    const tile = createPatternTile(getPatternById(patternId), {
      compact: true,
      index,
      active: state.activePlayerIndex === index,
    });
    tile.classList.add("player-tile");
    if (state.mismatches.has(index)) tile.classList.add("mismatch");
    tile.title = "Remove this card";
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
    setStatus("Chain full", "warn");
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
  setStatus("Undo", "idle");
}

function clearPlayerChain() {
  state.playerChain = [];
  state.lastResult = null;
  state.mismatches = new Set();
  clearPlayback();
  render();
  setStatus("Cleared", "idle");
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
    setStatus(`Perfect · Drill ${state.level}`, "success");
  } else if (state.playerChain.length < state.targetChain.length) {
    setStatus(`${state.targetChain.length - state.playerChain.length} left`, "warn");
  } else {
    setStatus(`${result.matched} / ${result.total} matched`, "warn");
  }

  render();
}

async function playChain(kind) {
  const chain = kind === "target" ? state.targetChain : state.playerChain;
  if (chain.length === 0) {
    setStatus("Empty chain", "warn");
    return;
  }

  clearPlayback();
  const audioContext = await getAudioContext();
  const startTime = audioContext.currentTime + 0.08;
  const events = scheduleChainEvents(chain, {
    bpm: state.config.bpm,
    startTime,
  });

  events.forEach((event) => scheduleAudioEvent(audioContext, event));
  scheduleHighlights(events, kind, startTime);
  setStatus(kind === "target" ? "Playing target" : "Playing player chain", "playing");
}

async function playPreview(patternId) {
  const audioContext = await getAudioContext();
  const startTime = audioContext.currentTime + 0.02;
  scheduleChainEvents([patternId], { bpm: state.config.bpm, startTime }).forEach((event) =>
    scheduleAudioEvent(audioContext, event)
  );
}

async function previewDeck() {
  const deckChain = getUnlockedPatterns(state.config).map((pattern) => pattern.id);
  if (deckChain.length === 0) return;

  clearPlayback();
  const audioContext = await getAudioContext();
  const startTime = audioContext.currentTime + 0.08;
  const shortBpm = Math.min(138, state.config.bpm + 18);
  const events = scheduleChainEvents(deckChain, {
    bpm: shortBpm,
    startTime,
  });
  events.forEach((event) => scheduleAudioEvent(audioContext, event));
  scheduleHighlights(events, "deck", startTime);
  setStatus("Preview deck", "playing");
}

async function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setStatus("Web Audio unavailable", "warn");
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

  playSnare(audioContext, {
    start: event.timeSeconds,
    duration: event.kind === "pulse" ? 0.045 : event.durationSeconds,
    velocity: event.kind === "pulse" ? event.velocity * 0.55 : event.velocity,
    accent: event.kind === "note",
  });
}

function playSnare(audioContext, options) {
  const duration = Math.max(0.045, Math.min(0.16, options.duration));
  const noise = audioContext.createBufferSource();
  const noiseFilter = audioContext.createBiquadFilter();
  const noiseGain = audioContext.createGain();
  const body = audioContext.createOscillator();
  const bodyGain = audioContext.createGain();
  const sampleCount = Math.ceil(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

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
  noise.start(options.start);
  body.start(options.start);
  noise.stop(options.start + duration + 0.02);
  body.stop(options.start + duration + 0.02);

  state.audioNodes.push(noise, body);
  [noise, body].forEach((node) => {
    node.addEventListener("ended", () => {
      state.audioNodes = state.audioNodes.filter((audioNode) => audioNode !== node);
    });
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
      setStatus("Ready", "idle");
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

function focusLibrary() {
  const firstCard = selectors.patternLibrary.querySelector("button:not(:disabled)");
  firstCard?.focus();
}

function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return {
      currentLevel: parsed.currentLevel || 1,
      passedLevels: Array.isArray(parsed.passedLevels) ? parsed.passedLevels : [],
    };
  } catch {
    return { currentLevel: 1, passedLevels: [] };
  }
}

function saveProgress() {
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      currentLevel: state.level,
      passedLevels: progress.passedLevels,
    })
  );
}

init();
