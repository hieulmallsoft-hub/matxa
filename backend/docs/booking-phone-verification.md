# Phone verification before booking

`GET /api/auth/me` and login responses expose `phoneVerified` and, when verified, `phoneNumber` regardless of login provider.

Before creating a booking, if `phoneVerified` is false:

1. With the current Bearer access token, POST `/api/auth/phone/link/send-otp` with `{ "phoneNumber": "+84901234567", "deviceId": "installation-id" }`.
2. Keep `challengeId` from the response. Render the resend countdown using `resendAfter` (do not hard-code 45 seconds); OTP validity is `expiresIn` seconds. Resend by calling the same endpoint and replace the challenge ID.
3. POST `/api/auth/phone/link/verify-otp` with `{ "challengeId": "...", "code": "123456", "deviceId": "installation-id" }`, using the same account and device. OTP codes have six numeric digits.
4. On success, the returned user has `phoneVerified: true`. Continue creating the booking. A verified user skips this flow on later bookings.

`POST /api/bookings` independently rejects unverified users with HTTP 403 and `code: PHONE_VERIFICATION_REQUIRED`. Quoting is still permitted. Verification links a phone to the existing account; it does not create a new login session. A number already linked to another account cannot be claimed.

Currently only the development SMS provider is implemented: it returns `debugOtp` and does not deliver real SMS. It is prohibited in production. A production SMS provider must be integrated before releasing this requirement to real users. No database migration is required for these API changes. Existing stored PHONE identities are treated as verified because they are created through the OTP/Firebase verification flows.
