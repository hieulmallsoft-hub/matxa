# Apple login

Set `APPLE_CLIENT_IDS` to the iOS Bundle ID (and Services IDs for other supported clients, comma-separated). Enable Sign in with Apple in the Apple Developer account and the iOS target. Apply database migrations with `npm run db:deploy` before deployment.

## Mobile flow

1. Call `POST /api/auth/apple/start` with no body. The response is `{ "nonce": "...", "expiresIn": 300 }`.
2. Keep the returned nonce for this login attempt. Set the Apple authorization request nonce to its SHA-256 hash, encoded as lowercase hexadecimal.
3. Obtain the Apple identity token, then call `POST /api/auth/apple` with `{ "idToken": "...", "nonce": "original nonce from step 1", "fullName": "optional name", "deviceId": "optional installation ID" }`.
4. Store the application's access and refresh tokens securely. Use the application refresh/logout endpoints for local sessions.

The challenge is stored in Redis for five minutes and consumed atomically after token verification. A retry after consumption, an expired challenge, or a nonce generated independently by the mobile app is rejected. Start a new Apple login attempt when necessary. Keep the original nonce private and do not log tokens.

This replaces the earlier client-generated nonce contract. Deploy the mobile integration alongside this backend change. The name is optional on later logins. Apple identity tokens, not Firebase ID tokens, are accepted by this endpoint.

Tests verify signed JWTs with local RSA keys and mocked Apple JWKS/Redis. Before release, validate real-device first login, repeat login, Hide My Email, refresh, logout, and blocked-account behavior. Apple authorization revocation and server notifications are not implemented by this flow.
