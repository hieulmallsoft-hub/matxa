# Booking chat

Base URL: `/api`. All endpoints require `Authorization: Bearer <accessToken>`.

## When chat is available

Mobile must not decide whether a user is selected. It may offer the chat button only
for a booking returned as assigned, but the backend always makes the final check.

| Booking type       | Customer                              | Technician                                                                          |
| ------------------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `DIRECT`           | Only the assigned technician          | Only when `booking.technicianId` is their profile                                   |
| `OPEN_MARKETPLACE` | Only the selected/assigned technician | Only when they are both `Booking.technicianId` and application status is `SELECTED` |

Applicants in `APPLIED`, `NOT_SELECTED`, `WITHDRAWN`, `DECLINED`, and `EXPIRED`
cannot create, read, send, or upload to a booking chat. They must not receive
customer contact details.

## Open/create booking chat

```http
POST /conversations/booking/{bookingId}
Authorization: Bearer <accessToken>
```

No body is accepted. The backend obtains customer and technician from the booking.
The same request is idempotent: a booking has exactly one conversation. Two bookings
between the same customer and technician have two different conversations.

The response contains `id` (conversation id) and `bookingId`. Existing pre-booking
legacy conversations remain accessible but Mobile must use the booking endpoint for
all new customer/KTV chats.

## Messages

```http
GET /conversations/{conversationId}/messages?page=1&limit=30
POST /conversations/{conversationId}/messages
```

Text body:

```json
{ "type": "TEXT", "text": "Em da toi gan dia chi roi." }
```

Location body:

```json
{ "type": "LOCATION", "latitude": 10.7769, "longitude": 106.7009, "address": "Quan 1, TP HCM" }
```

Latitude must be from `-90` to `90`; longitude from `-180` to `180`.
Mobile does not send `senderId` or `bookingId`; both are determined by the backend.
`SYSTEM` is read-only and can never be submitted by Mobile. The backend may create
`TECHNICIAN_SELECTED` when it creates the booking conversation.

## Images

Request an upload URL first:

```http
POST /conversations/{conversationId}/image-upload-url
```

```json
{ "fileName": "arrival.jpg", "contentType": "image/jpeg", "size": 183421 }
```

Upload the bytes to `uploadUrl`, then send only the returned `mediaKey`:

```json
{ "type": "IMAGE", "mediaKey": "<mediaKey from upload response>" }
```

Only JPEG, PNG, and WebP up to 10 MiB are accepted. Objects are scoped to the
conversation and uploading user. Message responses contain a short-lived signed
`mediaUrl`; do not save or construct external image URLs.

## Customer contact for technician

```http
GET /technician/jobs/{bookingId}/contact
```

This returns only the assigned customer's name and verified phone number. A rejected
or merely applied technician receives `403`/`404`; do not retry by changing a
technician id because the endpoint derives the technician from the access token.

## Notifications and deep links

`CHAT_MESSAGE_RECEIVED` push/notification data contains `conversationId`,
`messageId`, and, for booking chat, `bookingId`. Open the matching conversation on
notification tap. A push failure does not mean the message failed; refresh messages
through the REST endpoint or socket.

## Deferred rule

The product has not set a chat expiry interval after cancellation or completion.
Do not rely on a 24-hour or 7-day cutoff. Access is always revalidated against the
booking assignment and OPEN selection state.
