# Admin Operations API

All endpoints below require `Authorization: Bearer <accessToken>` from an active `ADMIN` account. The server checks the current role and account status on every request.

## Dashboard and operations

- `GET /api/admin/marketplace/dashboard` returns today's booking count, active verified technicians, review aggregate, completed bookings this month, and completed-booking revenue this month.
- `GET /api/admin/marketplace/users?page=1&limit=30&search=&role=&status=` returns a paginated, safe account list. Password hashes, session tokens, and identity secrets are never returned.
- `PATCH /api/admin/marketplace/users/:id/status` with `{ "status": "ACTIVE" | "BLOCKED" }` changes account availability. An administrator cannot block their own active session.
- `GET /api/admin/marketplace/bookings?page=1&limit=30&status=` returns booking operations data and service snapshots. It does not change booking state.
- `GET /api/admin/marketplace/technicians?page=1&limit=30` returns technician profiles and active-service counts.
- `PATCH /api/admin/marketplace/technicians/:id` updates allowed profile fields, including `isActive` and `isVerified`.

## Marketplace content

- `GET|POST /api/admin/marketplace/categories`
- `PATCH|DELETE /api/admin/marketplace/categories/:id` — delete is a safe deactivation (`isActive=false`), so services and booking history remain intact.
- `GET|POST /api/admin/marketplace/banners`
- `PATCH|DELETE /api/admin/marketplace/banners/:id`
- `GET|POST /api/admin/marketplace/promotions`
- `PATCH /api/admin/marketplace/promotions/:id`
- `POST /api/admin/marketplace/technicians` converts an existing user to `TECHNICIAN` and creates or updates their profile. It does not create a public registration endpoint for administrators.

All request bodies use the DTOs shown in Swagger under **Admin Marketplace**. Promotion codes are normalized to uppercase; promotion and banner date ranges are validated on the server.
