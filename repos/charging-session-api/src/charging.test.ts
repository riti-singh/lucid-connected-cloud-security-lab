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
if (fails) { throw new Error(`${fails} test(s) failed`); }
