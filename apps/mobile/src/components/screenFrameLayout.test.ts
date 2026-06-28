import assert from "node:assert/strict";
import test from "node:test";
import { getScreenFrameBottomPadding } from "./screenFrameLayout.js";

test("screen frame bottom padding leaves room for the Android tab bar", () => {
  assert.equal(getScreenFrameBottomPadding(0), 128);
  assert.equal(getScreenFrameBottomPadding(24), 152);
});
