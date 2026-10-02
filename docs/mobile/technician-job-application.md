# Open Marketplace — KTV job application API

Base URL: `/api`. All endpoints require `Authorization: Bearer <accessToken>`.

## States

`bookingStatus` is the booking lifecycle. `applicationStatus` belongs to the current KTV and must be used for the KTV UI.

| Booking | Application | UI |
| --- | --- | --- |
| `OPEN` | `null` | Don phu hop; hien Apply / Decline |
| `OPEN` | `APPLIED` | Dang cho khach xac nhan; hien Withdraw |
| `CONFIRMED` | `SELECTED` | Da duoc chon; duoc contact va complete |
| `CONFIRMED` | `NOT_SELECTED` | Khach da chon KTV khac |
| `CANCELLED` | any | Don da huy |
| `COMPLETED` | `SELECTED` | Da hoan thanh |

Do not infer an application state from `bookingStatus`, and never allow Mobile to choose a technician.

## List jobs

`GET /technician/jobs?city=HN&district=HN-CAU-GIAY&serviceId=<catalog-service-uuid>&status=OPEN&page=1&limit=20`

Only an active, verified, approved technician receives jobs. The API checks mode, catalog-category eligibility, location, availability and confirmed-booking conflicts before showing an un-applied OPEN job.

`status` may be a booking state (`OPEN`, `CONFIRMED`, `COMPLETED`, `CANCELLED`) or the current application state (`APPLIED`, `SELECTED`, `NOT_SELECTED`, `WITHDRAWN`, `DECLINED`, `EXPIRED`).

For an OPEN job the response deliberately omits exact customer address/contact. Important fields:

```json
{
  "bookingId": "uuid",
  "assignmentMode": "OPEN_MARKETPLACE",
  "bookingStatus": "OPEN",
  "applicationStatus": null,
  "scheduledStart": "2026-10-03T08:00:00.000Z",
  "mode": "HOME",
  "items": [{ "catalogServiceId": "uuid", "name": "Massage", "durationMinutes": 60, "price": 500000 }],
  "subtotal": 500000,
  "serviceFee": 100000,
  "totalAmount": 600000,
  "canApply": true,
  "canDecline": true
}
```

## Detail and application actions

| Action | Endpoint | Result |
| --- | --- | --- |
| Detail | `GET /technician/jobs/:bookingId` | Safe job detail and permissions |
| Apply | `POST /technician/jobs/:bookingId/apply` | Creates `APPLIED`; repeated request is idempotent while applied |
| Decline | `POST /technician/jobs/:bookingId/decline` | Creates terminal `DECLINED`, so the job is hidden |
| Withdraw | `POST /technician/jobs/:bookingId/withdraw` | Changes `APPLIED` to `WITHDRAWN` while booking remains OPEN |
| Contact | `GET /technician/jobs/:bookingId/contact` | Only a SELECTED KTV on CONFIRMED/COMPLETED booking |
| Complete | `POST /technician/jobs/:bookingId/complete` | Only assigned KTV after scheduled end |

There is no price/bid field in apply. Price is the backend snapshot created with the open booking.

## Customer APIs

Customer creates an open booking with platform catalog IDs:

`POST /bookings/open`

```json
{
  "items": [{ "catalogServiceId": "uuid" }],
  "mode": "HOME",
  "city": "HN",
  "district": "HN-CAU-GIAY",
  "addressId": "uuid",
  "scheduledStart": "2026-10-03T08:00:00.000Z",
  "applicationDeadlineAt": "2026-10-03T06:00:00.000Z",
  "paymentMethod": "CASH",
  "note": "Optional"
}
```

`applicationDeadlineAt` is optional; the backend does not impose a default expiry period.

Select one applicant:

`POST /bookings/:bookingId/select-technician`

```json
{ "applicationId": "uuid" }
```

The customer must own the OPEN booking. Selection is atomic: the winner becomes `SELECTED`, every other `APPLIED` application becomes `NOT_SELECTED`, the booking receives `technicianId` and transitions to `CONFIRMED`.

If another selection has already won, expect `409`. Refresh the booking instead of retrying with another application.

## Error handling and security

- `401`: session missing/expired.
- `403`: account is not an approved KTV, or KTV is not selected/eligible.
- `409`: booking is no longer OPEN, deadline has passed, application cannot transition, or selection raced.
- `400`: invalid catalog item, mode, schedule or payload.

KTV may apply to multiple open jobs. Availability and booking conflict are revalidated when the customer selects a winner. Losers must not show contact, chat, cancel, or complete controls.

## Existing DIRECT flow

Existing direct booking APIs continue unchanged: `POST /bookings`, `POST /technician/jobs/:id/accept`, `POST /technician/jobs/:id/decline`, and `POST /technician/jobs/:id/complete`.
