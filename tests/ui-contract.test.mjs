import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../assets/styles.css", import.meta.url), "utf8");

test("visible toolbar includes a play button for the target rhythm", () => {
  assert.match(html, /id="playControlButton"/);
  assert.match(html, /aria-label="播放目标节奏"/);
  assert.match(html, />播放</);
});

test("visible play button triggers target playback", () => {
  assert.match(appJs, /playControlButton:\s*document\.querySelector\("#playControlButton"\)/);
  assert.match(appJs, /selectors\.playControlButton\.addEventListener\("click",\s*\(\)\s*=>\s*playChain\("target"\)\)/);
});

test("empty chain slots open an embedded rhythm picker", () => {
  assert.match(html, /id="slotPicker"/);
  assert.match(html, /id="slotPickerGrid"/);
  assert.match(html, /id="closeSlotPickerButton"/);
  assert.match(appJs, /slotPicker:\s*document\.querySelector\("#slotPicker"\)/);
  assert.match(appJs, /empty\.addEventListener\("click",\s*\(\)\s*=>\s*openSlotPicker\(index\)\)/);
});

test("rhythm picker fills the selected slot instead of auto-filling the target", () => {
  assert.match(appJs, /function openSlotPicker\(slotIndex\)/);
  assert.match(appJs, /function setSlotPattern\(slotIndex,\s*patternId\)/);
  assert.match(appJs, /tile\.addEventListener\("click",\s*\(\)\s*=>\s*setSlotPattern\(state\.selectedSlotIndex,\s*pattern\.id\)\)/);
  assert.doesNotMatch(appJs, /const targetPattern = state\.targetChain\[index\]/);
});

test("drill footer exposes compact previous and next level buttons", () => {
  assert.match(html, /id="prevLevelButton"/);
  assert.match(html, /id="nextLevelButton"/);
  assert.match(html, />UP</);
  assert.match(html, />NEXT</);
  assert.match(appJs, /prevLevelButton:\s*document\.querySelector\("#prevLevelButton"\)/);
  assert.match(appJs, /nextLevelButton:\s*document\.querySelector\("#nextLevelButton"\)/);
  assert.match(appJs, /selectors\.prevLevelButton\.addEventListener\("click",\s*\(\)\s*=>\s*goToPreviousLevel\(\)\)/);
  assert.match(appJs, /selectors\.nextLevelButton\.addEventListener\("click",\s*\(\)\s*=>\s*goToNextLevel\(\)\)/);
  assert.match(appJs, /function goToPreviousLevel\(\)/);
  assert.match(appJs, /function goToNextLevel\(\)/);
  assert.match(css, /\.drill-progress\s*{[^}]*grid-template-columns:\s*70px minmax\(0,\s*1fr\) 70px/s);
  assert.match(css, /\.level-nav-button\s*{[^}]*width:\s*64px/s);
});

test("main game keeps one app-style viewport across desktop tablet and phone", () => {
  assert.match(css, /--app-width:\s*430px/);
  assert.match(css, /\.practice-card\s*{[^}]*width:\s*min\(100%,\s*var\(--app-width\)\)/s);
  assert.doesNotMatch(css, /@media\s*\(min-width:\s*760px\)/);
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*520px\)/);
  assert.doesNotMatch(css, /\.note-symbol\s*{[^}]*vw/s);
  assert.doesNotMatch(css, /\.target-chain\s+\.rhythm-card,[^}]*min-height:\s*clamp\([^;]*vw/s);
});

test("slot picker beat badges use compact Chinese app labels", () => {
  assert.match(appJs, /`\$\{pattern\.beats\} 拍`/);
  assert.match(appJs, /pattern\.beats === 1\) number\.classList\.add\("single-beat"\)/);
  assert.match(css, /\.slot-picker \.combo-number\.single-beat\s*{[^}]*display:\s*none/s);
  assert.doesNotMatch(appJs, /`\$\{pattern\.beats\} beat`/);
});

test("dense rhythm symbols use a smaller app-safe size", () => {
  assert.match(appJs, /Array\.from\(pattern\.symbol\)\.length > 2/);
  assert.match(appJs, /button\.classList\.add\("dense-rhythm"\)/);
  assert.match(css, /\.rhythm-card\.dense-rhythm \.note-symbol\s*{[^}]*font-size:\s*34px/s);
  assert.match(css, /\.slot-picker \.rhythm-card\.dense-rhythm \.note-symbol\s*{[^}]*font-size:\s*28px/s);
});

test("rest symbols render with app-native glyphs instead of mobile-unsafe text", () => {
  assert.match(appJs, /const REST_SYMBOLS = new Set\(\["𝄽", "𝄾", "𝄿"\]\)/);
  assert.match(appJs, /function appendSymbolNodes\(symbol,\s*pattern\)/);
  assert.match(appJs, /symbol\.append\(createRestGlyph\(char\)\)/);
  assert.match(appJs, /function createRestGlyph\(restSymbol\)/);
  assert.match(css, /\.rest-glyph\s*{/);
  assert.match(css, /\.note-symbol \.symbol-text\s*{/);
});

test("four sixteenths render as one connected notation glyph", () => {
  assert.match(appJs, /pattern\.glyph === "four-sixteenth-run"/);
  assert.match(appJs, /symbol\.append\(createFourSixteenthGlyph\(\)\)/);
  assert.match(appJs, /function createFourSixteenthGlyph\(\)/);
  assert.match(css, /\.four-sixteenth-glyph\s*{/);
});

test("beat dots drive a four-count audible prep interaction before playback", () => {
  assert.match(appJs, /scheduleCountInEvents/);
  assert.match(appJs, /beatDots:\s*document\.querySelectorAll\("\.beat-dots span"\)/);
  assert.match(appJs, /scheduleCountInHighlights\(countInEvents\)/);
  assert.match(appJs, /function scheduleCountInHighlights\(countInEvents\)/);
  assert.match(appJs, /function clearCountInDots\(\)/);
  assert.match(css, /\.beat-dots span\.active\s*{/);
});
