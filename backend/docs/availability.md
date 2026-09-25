# Availability API

`GET /api/marketplace/technicians/:technicianId/availability` keeps its existing endpoint.
`technicianId` is `TechnicianProfile.id`.

Use the booking-compatible `technicianServiceIds` query field (comma-separated or repeated), not a master service ID:

```http
GET /api/marketplace/technicians/<technician-profile-id>/availability?date=2026-10-01&technicianServiceIds=<service-1>,<service-2>&mode=HOME
```

`serviceIds` remains a compatible alias. Send only one of the two fields. `mode` is required
for computed slots because booking validates that every selected service supports that mode.
`date` is a Vietnam local date (`Asia/Ho_Chi_Minh`). Existing `from` plus `to` requests without
selected services retain their legacy working-window response.

Computed response:

```json
{
  "technicianId": "<TechnicianProfile UUID>",
  "date": "2026-10-01",
  "technicianServiceIds": ["<TechnicianService UUID>"],
  "serviceIds": ["<same TechnicianService UUID>"],
  "mode": "HOME",
  "timezone": "Asia/Ho_Chi_Minh",
  "totalDurationMinutes": 60,
  "durationMinutes": 60,
  "stepMinutes": 30,
  "slots": [{ "startAt": "2026-10-01T01:00:00.000Z", "endAt": "2026-10-01T02:00:00.000Z" }]
}
```

The existing 30-minute default grid is retained and may be changed per request with
`stepMinutes` (integer 5–120). The grid is anchored to each working interval's start.
Total duration is the database sum of distinct selected `TechnicianService.durationMinutes`;
frontend duration and price are never accepted.

The API makes three bounded queries: profile eligibility, selected services, then in parallel
working intervals plus bookings where `status IN (PENDING, CONFIRMED)`,
`scheduledStart < rangeEnd`, and `scheduledEnd > rangeStart`. It subtracts occupied half-open
intervals and returns only candidates whose full end time stays in a single working interval.
Past/current starts are excluded. Cancelled/completed bookings are intentionally absent from the
blocking query. No booking is created or held.

Quote and create-booking independently repeat working-interval and overlap validation inside the
write transaction; availability is UI guidance only. No migration is required.
