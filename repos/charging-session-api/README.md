# Charging Session API (TypeScript)
A synthetic service-to-service query for charging sessions. A caller carries an account scope, and must not read another account's records. The starter intentionally omits the ownership comparison. Run `tsc -p tsconfig.json && node --test dist/charging.test.js`.
