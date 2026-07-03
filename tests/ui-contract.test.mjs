import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");

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
