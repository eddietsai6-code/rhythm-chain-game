import {
  COUNT_IN_BEATS,
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
  scheduleCountInEvents,
} from "./rhythm-core.js";

const storageKey = "rhythm-chain-game-progress-v1";
const REST_SYMBOLS = new Set(["𝄽", "𝄾", "𝄿"]);
const svgNamespace = "http://www.w3.org/2000/svg";
const selectors = {
  practiceCard: document.querySelector(".practice-card"),
  levelTitle: document.querySelector("#levelTitle"),
  levelMeta: document.querySelector("#levelMeta"),
  comboReadout: document.querySelector("#comboReadout"),
  beatReadout: document.querySelector("#beatReadout"),
  accuracyReadout: document.querySelector("#accuracyReadout"),
  levelList: document.querySelector("#levelList"),
  beatDots: document.querySelectorAll(".beat-dots span"),
  targetChain: document.querySelector("#targetChain"),
  chainEntryButton: document.querySelector("#chainEntryButton"),
  playerLabel: document.querySelector("#playerLabel"),
  playerChain: document.querySelector("#playerChain"),
  slotPicker: document.querySelector("#slotPicker"),
  slotPickerTitle: document.querySelector("#slotPickerTitle"),
  slotPickerGrid: document.querySelector("#slotPickerGrid"),
  closeSlotPickerButton: document.querySelector("#closeSlotPickerButton"),
  targetBeatCount: document.querySelector("#targetBeatCount"),
  playerBeatCount: document.querySelector("#playerBeatCount"),
  statusText: document.querySelector("#statusText"),
  drillLabel: document.querySelector("#drillLabel"),
  levelJumpPanel: document.querySelector("#levelJumpPanel"),
  prevLevelButton: document.querySelector("#prevLevelButton"),
  nextLevelButton: document.querySelector("#nextLevelButton"),
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
  selectedSlotIndex: null,
  activeTargetIndex: null,
  activePlayerIndex: null,
  mismatches: new Set(),
  lastResult: null,
  playbackTimers: [],
  audioNodes: [],
  audioContext: null,
  playbackKind: null,
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
  selectors.playControlButton.addEventListener("click", handlePlayControl);
  selectors.tapButton.addEventListener("click", handleTap);
  selectors.chainEntryButton.addEventListener("click", openNextOpenSlot);
  selectors.closeSlotPickerButton.addEventListener("click", closeSlotPicker);
  selectors.playTargetButton.addEventListener("click", () => playChain("target"));
  selectors.playPlayerButton.addEventListener("click", () => playChain("player"));
  selectors.checkButton.addEventListener("click", checkPlayerChain);
  selectors.undoButton.addEventListener("click", undoLastCard);
  selectors.clearButton.addEventListener("click", clearPlayerChain);
  selectors.drillLabel.addEventListener("click", toggleLevelJumpPanel);
  selectors.prevLevelButton.addEventListener("click", () => goToPreviousLevel());
  selectors.nextLevelButton.addEventListener("click", () => goToNextLevel());
  selectors.nextButton.addEventListener("click", () => goToNextLevel());
  selectors.previewDeckButton.addEventListener("click", previewDeck);
  document.addEventListener("click", closeLevelJumpPanelFromOutside);
  document.addEventListener("keydown", closePanelsFromKeyboard);
}

function handlePlayControl() {
  if (state.playbackKind) {
    clearPlayback("stopped");
    return;
  }

  playChain(getPlayControlKind());
}

function getPlayControlKind() {
  return getFilledPlayerPatterns().length > 0 ? "player" : "target";
}

function openNextOpenSlot() {
  const firstEmptySlot = findFirstEmptySlot();
  if (firstEmptySlot === -1) {
    setStatus("链条已满", "warn");
    return;
  }

  openSlotPicker(firstEmptySlot);
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
  state.selectedSlotIndex = null;
  closeSlotPicker();
  closeLevelJumpPanel();
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
  renderSlotPicker();
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

function toggleLevelJumpPanel() {
  setLevelJumpPanelOpen(selectors.levelJumpPanel.hidden);
}

function closeLevelJumpPanel() {
  setLevelJumpPanelOpen(false);
}

function setLevelJumpPanelOpen(isOpen) {
  selectors.levelJumpPanel.hidden = !isOpen;
  selectors.drillLabel.setAttribute("aria-expanded", String(isOpen));
}

function closeLevelJumpPanelFromOutside(event) {
  if (selectors.levelJumpPanel.hidden) return;
  if (selectors.drillLabel.contains(event.target) || selectors.levelJumpPanel.contains(event.target)) return;
  closeLevelJumpPanel();
}

function closePanelsFromKeyboard(event) {
  if (event.key !== "Escape") return;
  closeSlotPicker();
  closeLevelJumpPanel();
}

function renderReadouts() {
  const targetBeats = calculateChainBeats(state.targetChain);
  const filledPlayerPatterns = getFilledPlayerPatterns();
  const playerBeats = calculateChainBeats(filledPlayerPatterns);
  const accuracy = state.lastResult ? `${Math.round(state.lastResult.accuracy * 100)}%` : "0%";
  const bpm = getPlaybackBpm();
  const chainEntryStrong = selectors.chainEntryButton.querySelector("strong");
  const chainEntryLabel = selectors.chainEntryButton.querySelector("span");
  const filledCount = filledPlayerPatterns.length;

  selectors.practiceCard.dataset.comboTier = String(state.config.comboCount);
  selectors.levelTitle.textContent = `第 ${state.level} / ${LEVEL_COUNT} 关`;
  selectors.levelMeta.textContent = `${state.config.comboCount} 组合 / ${bpm} BPM`;
  selectors.comboReadout.textContent = `${filledCount} / ${state.config.comboCount}`;
  selectors.beatReadout.textContent = String(targetBeats);
  selectors.accuracyReadout.textContent = accuracy;
  selectors.targetBeatCount.textContent = `${targetBeats} 拍`;
  selectors.playerBeatCount.textContent = `${playerBeats} 拍`;
  selectors.chainEntryButton.disabled = filledCount >= state.config.comboCount;
  selectors.chainEntryButton.setAttribute(
    "aria-label",
    filledCount >= state.config.comboCount ? "我的链条已填满" : `填写我的链条 ${filledCount}/${state.config.comboCount}`
  );
  if (chainEntryLabel) chainEntryLabel.textContent = "我的链条";
  if (chainEntryStrong) {
    chainEntryStrong.textContent =
      filledCount >= state.config.comboCount ? `${filledCount}/${state.config.comboCount}` : `填写 ${filledCount}/${state.config.comboCount}`;
  }
  selectors.drillLabel.textContent = `关卡 ${state.level}`;
  selectors.prevLevelButton.disabled = state.level <= 1;
  selectors.nextLevelButton.disabled = state.level >= LEVEL_COUNT;
  updatePlayControl(Boolean(state.playbackKind), state.playbackKind || getPlayControlKind());
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
  const showPlayerChain = shouldShowPlayerChain();
  selectors.playerLabel.hidden = !showPlayerChain;
  selectors.playerChain.hidden = !showPlayerChain;

  if (!showPlayerChain) {
    selectors.playerChain.replaceChildren();
    renderReadouts();
    return;
  }

  const slots = getVisiblePlayerSlotIndexes().map((index) => {
    const patternId = state.playerChain[index];
    if (!patternId) {
      const empty = document.createElement("button");
      empty.className = "empty-slot";
      empty.type = "button";
      empty.textContent = "+";
      empty.title = `Slot ${index + 1}`;
      empty.addEventListener("click", () => openSlotPicker(index));
      return empty;
    }

    const tile = createPatternTile(getPatternById(patternId), {
      compact: true,
      index,
      active: state.activePlayerIndex === index,
    });
    tile.classList.add("player-tile");
    if (state.mismatches.has(index)) tile.classList.add("mismatch");
    tile.title = "重新选择这个节奏";
    tile.addEventListener("click", () => openSlotPicker(index));
    return tile;
  });

  selectors.playerChain.replaceChildren(...slots);
  renderReadouts();
}

function shouldShowPlayerChain() {
  return state.selectedSlotIndex !== null || state.playerChain.some(Boolean);
}

function getVisiblePlayerSlotIndexes() {
  const indexes = new Set();
  state.playerChain.forEach((patternId, index) => {
    if (patternId) indexes.add(index);
  });

  if (state.selectedSlotIndex !== null) indexes.add(state.selectedSlotIndex);

  const firstEmptySlot = findFirstEmptySlot();
  if (firstEmptySlot !== -1) indexes.add(firstEmptySlot);

  return [...indexes].sort((first, second) => first - second);
}

function renderLibrary() {
  const unlockedPatterns = getUnlockedPatterns(state.config);
  selectors.libraryCount.textContent = String(unlockedPatterns.length);
  selectors.patternLibrary.replaceChildren(
    ...unlockedPatterns.map((pattern) => {
      const tile = createPatternTile(pattern, { compact: false });
      tile.addEventListener("click", () => addPattern(pattern.id));
      tile.disabled = getFilledPlayerPatterns().length >= state.config.comboCount;
      return tile;
    })
  );
}

function renderSlotPicker() {
  if (state.selectedSlotIndex === null) {
    selectors.slotPicker.hidden = true;
    return;
  }

  const currentPatternId = state.playerChain[state.selectedSlotIndex] || null;
  selectors.slotPicker.hidden = false;
  selectors.slotPickerTitle.textContent = `选择第 ${state.selectedSlotIndex + 1} 格节拍`;
  selectors.slotPickerGrid.replaceChildren(
    ...getUnlockedPatterns(state.config).map((pattern) => {
      const tile = createPatternTile(pattern, { compact: true });
      tile.classList.add("slot-picker-card");
      if (pattern.id === currentPatternId) tile.classList.add("selected");
      tile.addEventListener("click", () => setSlotPattern(state.selectedSlotIndex, pattern.id));
      return tile;
    })
  );
}

function openSlotPicker(slotIndex) {
  state.selectedSlotIndex = Math.min(state.config.comboCount - 1, Math.max(0, Number(slotIndex) || 0));
  renderPlayerChain();
  renderSlotPicker();
  setStatus(`选择第 ${state.selectedSlotIndex + 1} 格`, "idle");
  selectors.slotPicker.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function closeSlotPicker() {
  state.selectedSlotIndex = null;
  selectors.slotPicker.hidden = true;
  selectors.slotPickerGrid.replaceChildren();
  if (state.config) renderPlayerChain();
}

function setSlotPattern(slotIndex, patternId) {
  const index = Number(slotIndex);
  if (!Number.isInteger(index) || index < 0 || index >= state.config.comboCount) return;

  state.playerChain[index] = patternId;
  trimEmptyTailSlots();
  state.lastResult = null;
  state.mismatches = new Set();
  closeSlotPicker();
  playPreview(patternId);
  render();
  setStatus(`第 ${index + 1} 格已填入`, "idle");
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
  if (Array.from(pattern.symbol).length > 2 || pattern.id === "fourSixteenths" || pattern.family === "syncopation") {
    button.classList.add("dense-rhythm");
  }

  const number = document.createElement("span");
  number.className = "combo-number";
  number.textContent = Number.isInteger(options.index) ? String(options.index + 1) : `${pattern.beats} 拍`;
  if (!Number.isInteger(options.index) && pattern.beats === 1) number.classList.add("single-beat");

  const symbol = document.createElement("span");
  symbol.className = "note-symbol";
  appendSymbolNodes(symbol, pattern);

  const label = document.createElement("span");
  label.className = "card-label";
  label.textContent = pattern.name;

  const syllables = document.createElement("span");
  syllables.className = "syllables";
  syllables.textContent = pattern.syllables;

  button.append(number, symbol, label, syllables);
  return button;
}

function appendSymbolNodes(symbol, pattern) {
  if (pattern.glyph === "eighth-two-sixteenths" || pattern.glyph === "two-sixteenths-eighth") {
    symbol.append(createMixedSixteenthGlyph(pattern.glyph));
    return;
  }

  if (pattern.glyph === "four-sixteenth-run") {
    symbol.append(createFourSixteenthGlyph());
    return;
  }

  if (pattern.glyph === "sixteenth-eighth-sixteenth" || pattern.glyph === "sixteenth-rest-three-sixteenths") {
    symbol.append(createSyncopationGlyph(pattern.glyph));
    return;
  }

  Array.from(pattern.symbol).forEach((char) => {
    if (REST_SYMBOLS.has(char)) {
      symbol.append(createRestGlyph(char));
      return;
    }

    const text = document.createElement("span");
    text.className = "symbol-text";
    text.textContent = char;
    symbol.append(text);
  });
}

function createFourSixteenthGlyph() {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("four-sixteenth-glyph");
  svg.setAttribute("viewBox", "0 0 104 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  svg.append(
    createSvgElement("path", { d: "M25 12 L95 12 L95 19 L25 19 Z", fill: "currentColor" }),
    createSvgElement("path", { d: "M25 25 L95 25 L95 32 L25 32 Z", fill: "currentColor" }),
    createSvgElement("line", {
      x1: "25",
      y1: "16",
      x2: "25",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("line", {
      x1: "48",
      y1: "16",
      x2: "48",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("line", {
      x1: "71",
      y1: "16",
      x2: "71",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("line", {
      x1: "94",
      y1: "16",
      x2: "94",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("ellipse", {
      cx: "17",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 17 50)",
    }),
    createSvgElement("ellipse", {
      cx: "40",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 40 50)",
    }),
    createSvgElement("ellipse", {
      cx: "63",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 63 50)",
    }),
    createSvgElement("ellipse", {
      cx: "86",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 86 50)",
    })
  );
  return svg;
}

function createMixedSixteenthGlyph(glyph) {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("mixed-sixteenth-glyph");
  svg.classList.add(glyph);
  svg.setAttribute("viewBox", "0 0 96 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const lowerBeamStart = glyph === "eighth-two-sixteenths" ? 50 : 21;
  const lowerBeamEnd = glyph === "eighth-two-sixteenths" ? 82 : 53;

  svg.append(
    createSvgElement("path", { d: "M22 12 L84 12 L84 19 L22 19 Z", fill: "currentColor" }),
    createSvgElement("path", {
      d: `M${lowerBeamStart} 25 L${lowerBeamEnd} 25 L${lowerBeamEnd} 32 L${lowerBeamStart} 32 Z`,
      fill: "currentColor",
    }),
    createSvgElement("line", {
      x1: "22",
      y1: "16",
      x2: "22",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("line", {
      x1: "53",
      y1: "16",
      x2: "53",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("line", {
      x1: "83",
      y1: "16",
      x2: "83",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("ellipse", {
      cx: "14",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 14 50)",
    }),
    createSvgElement("ellipse", {
      cx: "45",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 45 50)",
    }),
    createSvgElement("ellipse", {
      cx: "75",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 75 50)",
    })
  );
  return svg;
}

function createSyncopationGlyph(glyph) {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("syncopation-glyph");
  svg.classList.add(glyph);
  svg.setAttribute("viewBox", "0 0 104 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  if (glyph === "sixteenth-rest-three-sixteenths") {
    svg.append(
      createSvgElement("circle", {
        class: "sixteenth-rest-flag-upper syncopation-sixteenth-rest-flag-upper",
        cx: "16",
        cy: "16",
        r: "5.5",
        fill: "currentColor",
      }),
      createSvgElement("circle", {
        class: "sixteenth-rest-flag-lower syncopation-sixteenth-rest-flag-lower",
        cx: "23",
        cy: "29",
        r: "5.5",
        fill: "currentColor",
      }),
      createSvgElement("path", {
        class: "sixteenth-rest-stem syncopation-sixteenth-rest-stem",
        d: "M30 7 C36 19 33 31 27 42 C24 48 20 54 16 58",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "6",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
      createSvgElement("path", {
        class: "syncopation-sixteenth-rest-hook-upper",
        d: "M22 16 C31 19 36 25 33 32",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "5",
        "stroke-linecap": "round",
      }),
      createSvgElement("path", {
        class: "syncopation-sixteenth-rest-hook-lower",
        d: "M28 29 C36 33 37 41 30 48",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "5",
        "stroke-linecap": "round",
      }),
      createSvgElement("path", { d: "M48 12 L94 12 L94 19 L48 19 Z", fill: "currentColor" }),
      createSvgElement("path", { d: "M48 25 L94 25 L94 32 L48 32 Z", fill: "currentColor" }),
      createSvgElement("line", {
        x1: "48",
        y1: "16",
        x2: "48",
        y2: "49",
        stroke: "currentColor",
        "stroke-width": "5",
        "stroke-linecap": "round",
      }),
      createSvgElement("line", {
        x1: "71",
        y1: "16",
        x2: "71",
        y2: "49",
        stroke: "currentColor",
        "stroke-width": "5",
        "stroke-linecap": "round",
      }),
      createSvgElement("line", {
        x1: "94",
        y1: "16",
        x2: "94",
        y2: "49",
        stroke: "currentColor",
        "stroke-width": "5",
        "stroke-linecap": "round",
      }),
      createSvgElement("ellipse", {
        cx: "40",
        cy: "50",
        rx: "9",
        ry: "6",
        fill: "currentColor",
        transform: "rotate(-18 40 50)",
      }),
      createSvgElement("ellipse", {
        cx: "63",
        cy: "50",
        rx: "9",
        ry: "6",
        fill: "currentColor",
        transform: "rotate(-18 63 50)",
      }),
      createSvgElement("ellipse", {
        cx: "86",
        cy: "50",
        rx: "9",
        ry: "6",
        fill: "currentColor",
        transform: "rotate(-18 86 50)",
      })
    );
    return svg;
  }

  svg.append(
    createSvgElement("path", { d: "M24 12 L84 12 L84 19 L24 19 Z", fill: "currentColor" }),
    createSvgElement("path", { d: "M24 25 L42 25 L42 32 L24 32 Z", fill: "currentColor" }),
    createSvgElement("path", { d: "M70 25 L84 25 L84 32 L70 32 Z", fill: "currentColor" }),
    createSvgElement("line", {
      x1: "24",
      y1: "16",
      x2: "24",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("line", {
      x1: "54",
      y1: "16",
      x2: "54",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("line", {
      x1: "84",
      y1: "16",
      x2: "84",
      y2: "49",
      stroke: "currentColor",
      "stroke-width": "5",
      "stroke-linecap": "round",
    }),
    createSvgElement("ellipse", {
      cx: "16",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 16 50)",
    }),
    createSvgElement("ellipse", {
      cx: "46",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 46 50)",
    }),
    createSvgElement("ellipse", {
      cx: "76",
      cy: "50",
      rx: "9",
      ry: "6",
      fill: "currentColor",
      transform: "rotate(-18 76 50)",
    })
  );
  return svg;
}

function createRestGlyph(restSymbol) {
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.classList.add("rest-glyph");
  svg.setAttribute("viewBox", "0 0 48 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  if (restSymbol === "𝄾") {
    svg.classList.add("eighth-rest-glyph");
    svg.append(
      createSvgElement("circle", { cx: "19", cy: "20", r: "7", fill: "currentColor" }),
      createSvgElement("path", {
        d: "M26 20 C35 27 29 43 18 57",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "7",
        "stroke-linecap": "round",
      })
    );
    return svg;
  }

  if (restSymbol === "𝄿") {
    svg.classList.add("sixteenth-rest-glyph");
    svg.append(
      createSvgElement("circle", { class: "sixteenth-rest-flag-upper", cx: "17", cy: "17", r: "5.8", fill: "currentColor" }),
      createSvgElement("circle", { class: "sixteenth-rest-flag-lower", cx: "23", cy: "31", r: "5.8", fill: "currentColor" }),
      createSvgElement("path", {
        class: "sixteenth-rest-stem",
        d: "M31 8 C37 20 34 32 28 43 C25 49 21 54 17 59",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "6.5",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
      createSvgElement("path", {
        class: "sixteenth-rest-hook-upper",
        d: "M23 17 C33 20 38 26 34 33",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "5.5",
        "stroke-linecap": "round",
      }),
      createSvgElement("path", {
        class: "sixteenth-rest-hook-lower",
        d: "M29 31 C38 35 39 43 31 50",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "5.5",
        "stroke-linecap": "round",
      })
    );
    return svg;
  }

  svg.classList.add("quarter-rest-glyph");
  svg.append(
    createSvgElement("path", {
      d: "M29 7 C18 15 34 24 23 32 C12 40 34 46 21 58",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "7",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
  return svg;
}

function createSvgElement(tagName, attributes) {
  const element = document.createElementNS(svgNamespace, tagName);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

function addPattern(patternId) {
  const firstEmptySlot = findFirstEmptySlot();
  if (firstEmptySlot === -1) {
    setStatus("链条已满", "warn");
    return;
  }

  setSlotPattern(firstEmptySlot, patternId);
}

function undoLastCard() {
  trimEmptyTailSlots();
  state.playerChain.pop();
  trimEmptyTailSlots();
  state.lastResult = null;
  state.mismatches = new Set();
  closeSlotPicker();
  render();
  setStatus("撤销", "idle");
}

function clearPlayerChain() {
  state.playerChain = [];
  state.lastResult = null;
  state.mismatches = new Set();
  clearPlayback();
  closeSlotPicker();
  render();
  setStatus("已清空", "idle");
}

function goToPreviousLevel() {
  if (state.level <= 1) {
    setStatus("已经是第一关", "warn");
    return;
  }

  loadLevel(state.level - 1);
}

function goToNextLevel() {
  if (state.level >= LEVEL_COUNT) {
    setStatus("已经是最后一关", "warn");
    return;
  }

  loadLevel(state.level + 1);
}

function checkPlayerChain() {
  const filledPlayerPatterns = getFilledPlayerPatterns();
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
  } else if (filledPlayerPatterns.length < state.targetChain.length) {
    setStatus(`还差 ${state.targetChain.length - filledPlayerPatterns.length} 个`, "warn");
  } else {
    setStatus(`${result.matched} / ${result.total} 匹配`, "warn");
  }

  render();
}

async function playChain(kind) {
  const chain = kind === "target" ? state.targetChain : getFilledPlayerPatterns();
  if (chain.length === 0) {
    setStatus("没有内容", "warn");
    return;
  }

  clearPlayback();
  const audioContext = await getAudioContext();
  state.playbackKind = kind;
  updatePlayControl(true, kind);
  const bpm = getPlaybackBpm();
  const beatDuration = 60 / bpm;
  const countInStartTime = audioContext.currentTime + 0.08;
  const countInEvents = scheduleCountInEvents({
    bpm,
    startTime: countInStartTime,
  });
  const startTime = countInStartTime + COUNT_IN_BEATS * beatDuration;
  const events = scheduleChainEvents(chain, {
    bpm,
    startTime,
  });

  countInEvents.forEach((event) => scheduleAudioEvent(audioContext, event));
  events.forEach((event) => scheduleAudioEvent(audioContext, event));
  scheduleCountInHighlights(countInEvents);
  scheduleHighlights(events, kind, startTime);
  setStatus("预备", "playing");
  state.playbackTimers.push(
    window.setTimeout(() => {
      setStatus(kind === "target" ? "正在播放目标" : "正在播放链条", "playing");
    }, Math.max(0, (startTime - audioContext.currentTime) * 1000))
  );
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
    accent: event.kind === "note" || event.accent === true,
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
  const endDelay = Math.max(0, (lastEvent.timeSeconds - audioContext.currentTime) * 1000 + 900);
  state.playbackTimers.push(
    window.setTimeout(() => {
      state.playbackKind = null;
      updatePlayControl(false);
      state.activeTargetIndex = null;
      state.activePlayerIndex = null;
      renderChain(selectors.targetChain, state.targetChain, "target");
      renderPlayerChain();
      clearDeckHighlight();
      clearCountInDots();
      setStatus("准备", "idle");
    }, endDelay)
  );
}

function scheduleCountInHighlights(countInEvents) {
  const audioContext = state.audioContext;
  countInEvents.forEach((event) => {
    const delay = Math.max(0, (event.timeSeconds - audioContext.currentTime) * 1000);
    state.playbackTimers.push(
      window.setTimeout(() => {
        clearCountInDots();
        selectors.beatDots[event.countIndex]?.classList.add("active");
      }, delay)
    );
  });
}

function clearCountInDots() {
  selectors.beatDots.forEach((dot) => dot.classList.remove("active"));
}

function highlightDeckCard(patternId) {
  clearDeckHighlight();
  const card = selectors.patternLibrary.querySelector(`[data-pattern-id="${patternId}"]`);
  if (card) card.classList.add("active");
}

function clearDeckHighlight() {
  selectors.patternLibrary.querySelectorAll(".active").forEach((card) => card.classList.remove("active"));
}

function clearPlayback(reason = "reset") {
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
  state.playbackKind = null;
  state.activeTargetIndex = null;
  state.activePlayerIndex = null;
  clearCountInDots();
  clearDeckHighlight();
  updatePlayControl(false);

  if (reason === "stopped") {
    setStatus("准备", "idle");
  }
}

function setStatus(message, variant) {
  selectors.statusText.textContent = message;
  selectors.statusText.dataset.variant = variant;
}

function updatePlayControl(isPlaying, kind = getPlayControlKind()) {
  const icon = selectors.playControlButton.querySelector("span");
  const strong = selectors.playControlButton.querySelector("strong");
  const label = kind === "player" ? "播放我的链条" : "播放目标节奏";

  selectors.playControlButton.dataset.playing = String(isPlaying);
  selectors.playControlButton.dataset.kind = kind;
  selectors.playControlButton.setAttribute("aria-pressed", String(isPlaying));
  selectors.playControlButton.setAttribute("aria-label", isPlaying ? "停止播放" : label);
  if (icon) icon.textContent = isPlaying ? "Ⅱ" : "▶";
  if (strong) {
    strong.textContent = isPlaying ? "暂停" : "播放";
  }
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

function getFilledPlayerPatterns() {
  return state.playerChain.filter(Boolean);
}

function findFirstEmptySlot() {
  for (let index = 0; index < state.config.comboCount; index += 1) {
    if (!state.playerChain[index]) return index;
  }

  return -1;
}

function trimEmptyTailSlots() {
  while (state.playerChain.length > 0 && !state.playerChain.at(-1)) {
    state.playerChain.pop();
  }
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
