import assert from "node:assert/strict";
import test from "node:test";
import { buildActionButtonAccessibility } from "./actionButtonAccessibility.js";

test("action button accessibility keeps the action label while busy", () => {
  const props = buildActionButtonAccessibility("Refresh", {
    busy: true,
    disabled: true,
  });

  assert.equal(props.accessibilityLabel, "Refresh");
  assert.deepEqual(props.accessibilityState, { busy: true, disabled: true });
});

test("action button accessibility supports explicit busy labels", () => {
  const props = buildActionButtonAccessibility("Check Remote", {
    busy: true,
    disabled: true,
    busyLabel: "Checking remote",
  });

  assert.equal(props.accessibilityLabel, "Checking remote");
  assert.deepEqual(props.accessibilityState, { busy: true, disabled: true });
});
