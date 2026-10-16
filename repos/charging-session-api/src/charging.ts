export interface Session { id: string; accountId: string; kwh: number; locationZone: string }
export interface Caller { accountId: string }
const sessions: Session[] = [
  {id: "session-a", accountId: "fleet-alpha", kwh: 18.2, locationZone: "synthetic-zone-west"},
  {id: "session-b", accountId: "fleet-beta", kwh: 29.4, locationZone: "synthetic-zone-east"}
];
export function getChargingSession(caller: Caller, sessionId: string): Session | undefined {
  // Intentionally missing accountId authorization constraint.
  return sessions.find(s => s.id === sessionId);
}
