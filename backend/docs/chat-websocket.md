# Matxa chat WebSocket

Connect Socket.IO to namespace `/chat`. Authenticate with `auth.token` or the
`Authorization: Bearer <accessToken>` handshake header.

Client events:

- `conversation.open`: `{ conversationId }`
- `conversation.close`: `{ conversationId }`
- `message.send`: `{ conversationId, type, text?, mediaUrl?, mediaKey?, latitude?, longitude?, address?, bookingId? }`
- `message.edit`: `{ messageId, text }`
- `message.recall`: `{ messageId }`
- `message.read`: `{ conversationId }`
- `typing.start`: `{ conversationId }`
- `typing.stop`: `{ conversationId }`

Server events:

- `auth.error`
- `conversation.opened`, `conversation.closed`
- `message.sent`, `message.created`, `message.updated`, `message.recalled`
- `message.read`, `message.read.ack`
- `typing.started`, `typing.stopped`

REST and Socket.IO share the same access token and authorization rules. Editing
and recalling are limited to the sender and expire after 15 minutes.
