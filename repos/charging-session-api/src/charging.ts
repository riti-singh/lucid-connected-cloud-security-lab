export interface Session { id: string; accountId: string; kwh: number; locationZone: string }
export interface Caller { accountId: string }
const sessions: Session[] = [
  {id: "session-a", accountId: "fleet-alpha", kwh: 18.2, locationZone: "synthetic-zone-west"},
  {id: "session-b", accountId: "fleet-beta", kwh: 29.4, locationZone: "synthetic-zone-east"}
];
export function getChargingSession(caller: Caller, sessionId: string): Session | undefined {
  // caller.accountId is assumed to come from a trusted, authenticated context;
  // this synthetic service does not itself validate it.
  return sessions.find(s => s.id === sessionId && s.accountId === caller.accountId);
}
