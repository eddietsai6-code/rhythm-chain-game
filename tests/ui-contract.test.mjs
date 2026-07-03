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
