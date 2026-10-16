import { getChargingSession } from "./charging";
// No Node typings required: tiny zero-dependency assertion harness.
function assert(ok: boolean, message: string) { if (!ok) throw Error(message); }
let fails = 0;
function test(name: string, fn: () => void) { try { fn(); console.log("PASS", name); } catch(e) { fails++; console.error("FAIL", name, String(e)); } }
test("same-account-access", () => {
  assert(getChargingSession({accountId:"fleet-alpha"}, "session-a")?.id === "session-a", "expected own session");
});
test("cross-account-denied", () => {
  assert(getChargingSession({accountId:"fleet-alpha"}, "session-b") === undefined, "cross-account record was exposed");
});
test("nonexistent-session-denied", () => {
  assert(getChargingSession({accountId:"fleet-alpha"}, "session-missing") === undefined, "nonexistent session returned a record");
});
test("unknown-account-denied", () => {
  assert(getChargingSession({accountId:"fleet-gamma"}, "session-a") === undefined, "unknown account read session-a");
  assert(getChargingSession({accountId:"fleet-gamma"}, "session-b") === undefined, "unknown account read session-b");
});
test("empty-account-denied", () => {
  assert(getChargingSession({accountId:""}, "session-a") === undefined, "empty account read session-a");
  assert(getChargingSession({accountId:""}, "session-b") === undefined, "empty account read session-b");
});
if (fails) { throw new Error(`${fails} test(s) failed`); }
