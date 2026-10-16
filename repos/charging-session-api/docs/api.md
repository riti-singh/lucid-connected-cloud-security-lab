# Charging Session API: interface

> **Synthetic / fictional.** Fictional lab service; not real Lucid code or data.

TypeScript module `src/charging.ts` (no HTTP layer is implemented).

## Types
```ts
interface Session { id: string; accountId: string; kwh: number; locationZone: string }
interface Caller  { accountId: string }
```

## `getChargingSession(caller: Caller, sessionId: string): Session | undefined`

| Input | Type | Description |
| --- | --- | --- |
| `caller` | `Caller` | Calling service's account scope. |
| `sessionId` | `string` | ID of the requested charging session. |

**Returns:** a `Session`, or `undefined` when no session matches.

**Contract:** a caller must not read another account's records.
