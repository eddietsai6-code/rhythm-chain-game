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

test("drill footer exposes a visible next-level button", () => {
  assert.match(html, /id="nextLevelButton"/);
  assert.match(html, /aria-label="进入下一关"/);
  assert.match(appJs, /nextLevelButton:\s*document\.querySelector\("#nextLevelButton"\)/);
  assert.match(appJs, /selectors\.nextLevelButton\.addEventListener\("click",\s*\(\)\s*=>\s*goToNextLevel\(\)\)/);
  assert.match(appJs, /function goToNextLevel\(\)/);
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
