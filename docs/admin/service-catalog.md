# Admin service catalog

Admin-only endpoints:

- `GET /api/admin/service-catalog`
- `POST /api/admin/service-catalog`
- `PATCH /api/admin/service-catalog/:id`
- `DELETE /api/admin/service-catalog/:id`

Delete is a safe deactivate (`isActive=false`), never a hard delete. A catalog item has a category, stable slug, supported modes, pricing template, sort order and price options. Templates enforce durations: `STANDARD_60_90_120`, `FIXED_60`, or `DATE_2_4_6_HOURS`.

Run `npm run db:seed-service-catalog` to idempotently seed the initial Figma catalog. Review seeded prices before a production release; admin updates are the source of truth for future OPEN bookings, while existing BookingItem snapshots remain unchanged.
