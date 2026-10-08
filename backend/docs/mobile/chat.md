# Chat API - Mobile Integration

## 1. Màn hình sử dụng

- Màn hình **Tin nhắn**: danh sách conversation, người chat, tin cuối và số chưa đọc.
- Màn hình **Chat Detail**: lịch sử và gửi message.
- Nhấn notification `CHAT_MESSAGE`: mở đúng conversation rồi tải lại message từ backend.

## 2. Authentication

REST dùng `Authorization: Bearer <accessToken>`. Socket.IO dùng token trong `auth.token` hoặc header `Authorization: Bearer ...` khi kết nối namespace `/chat`.

## 3. Conversation Flow

Conversation hiện là thread 1–1 theo cặp user. `POST /api/conversations` nhận `participantId` là **User.id**, không phải `TechnicianProfile.id`. Backend tạo `participantKey` bằng hai User ID đã sort và lưu unique, nên gọi lại cùng cặp sẽ mở lại conversation cũ.

Code hiện tại cho phép chat với user ACTIVE được truyền vào `participantId`; chưa có rule bắt buộc phải có booking. Conversation không có quan hệ `bookingId` trong schema.

## 4. Endpoints thực tế

| Method | Endpoint                                           | Mục đích                                |
| ------ | -------------------------------------------------- | --------------------------------------- |
| POST   | `/api/conversations`                               | Tạo hoặc mở conversation 1–1            |
| GET    | `/api/conversations`                               | Danh sách conversation của user         |
| GET    | `/api/conversations/{id}/messages?page=1&limit=30` | Lịch sử message                         |
| POST   | `/api/conversations/{id}/messages`                 | Gửi message                             |
| PATCH  | `/api/conversations/{id}/read`                     | Mark message của đối phương đã đọc      |
| POST   | `/api/conversations/{id}/image-upload-url`         | Lấy presigned URL upload ảnh            |
| DELETE | `/api/conversations/{id}`                          | Ẩn conversation ở phía user hiện tại    |
| PATCH  | `/api/conversations/messages/{messageId}`          | Sửa message text của mình trong 15 phút |
| DELETE | `/api/conversations/messages/{messageId}/recall`   | Thu hồi message của mình trong 15 phút  |

## 5. Conversation list

Request: `GET /api/conversations`

Response thực tế là một mảng, sort theo hoạt động mới nhất:

```json
[
  {
    "id": "conversation-id",
    "participant": {
      "id": "user-id",
      "displayName": "Nguyen Thi Mai",
      "avatarUrl": "https://..."
    },
    "lastMessage": {
      "id": "message-id",
      "conversationId": "conversation-id",
      "senderId": "user-id",
      "type": "TEXT",
      "text": "Bạn nhắn cho mình địa chỉ nhé",
      "createdAt": "2026-09-29T10:00:00.000Z",
      "readAt": null
    },
    "lastMessageAt": "2026-09-29T10:00:00.000Z",
    "unreadCount": 2
  }
]
```

`participant.id` và message `senderId` đều là User ID. `unreadCount` chỉ đếm message của đối phương chưa đọc; message của chính mình không được tính.

## 6. Message list

`GET /api/conversations/{id}/messages?page=1&limit=30`

```json
{
  "items": [
    {
      "id": "message-id",
      "conversationId": "conversation-id",
      "senderId": "user-id",
      "type": "TEXT",
      "text": "Bạn nhắn cho mình địa chỉ nhé",
      "mediaUrl": null,
      "mediaKey": null,
      "latitude": null,
      "longitude": null,
      "address": null,
      "bookingId": null,
      "editedAt": null,
      "recalledAt": null,
      "deliveredAt": null,
      "readAt": null,
      "createdAt": "2026-09-29T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 30
}
```

Backend lấy page mới nhất theo `createdAt` giảm dần. Mobile có thể đảo `items` để render từ cũ đến mới. `limit` từ 1 đến 100, mặc định 30.

## 7. Send message

Ví dụ text:

```http
POST /api/conversations/{id}/messages
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "type": "TEXT",
  "text": "Bạn nhắn cho mình địa chỉ nhé"
}
```

Các type thật đang hỗ trợ: `TEXT`, `IMAGE`, `LOCATION`. Text được trim và không được rỗng/whitespace; tối đa 4000 ký tự. IMAGE phải dùng `mediaUrl` và `mediaKey` do presigned upload của conversation tạo. LOCATION cần `latitude`, `longitude`, có thể kèm `address`.

Mobile không gửi `senderId` hoặc `recipientId`; sender lấy từ access token và recipient suy ra từ conversation.

## 8. Read/unread

Flow Mobile:

```text
Mở conversation
→ GET messages
→ PATCH /api/conversations/{id}/read
→ cập nhật unreadCount = 0 ở local
```

Mark read idempotent, chỉ cập nhật message của đối phương và `lastReadAt` của member hiện tại. User không thuộc conversation nhận lỗi quyền truy cập.

## 9. Realtime

Project đã có Socket.IO namespace `/chat`.

- Kết nối với JWT trong `auth.token` hoặc Bearer header.
- `conversation.open` / `conversation.close` với `{ "conversationId": "..." }`.
- `message.send` gửi message kèm `conversationId`.
- Server emit `message.created` sau khi message đã lưu DB.
- `message.read`, `typing.start`, `typing.stop`.
- `message.updated`, `message.recalled` khi sửa/thu hồi.
- Server trả `auth.error` và ngắt socket nếu token/session không hợp lệ.

REST vẫn là fallback bắt buộc. Message được persist trước rồi mới emit realtime. Nếu FCM lỗi, message vẫn tồn tại.

## 10. FCM Chat Notification

Khi recipient không đang xem conversation, backend tạo in-app notification và gửi push:

```json
{
  "type": "CHAT_MESSAGE",
  "conversationId": "conversation-id",
  "messageId": "message-id"
}
```

Mobile nhận payload rồi mở conversation và fetch lại message; payload không phải full message data. Mobile không gửi `push=true` để quyết định business push.

## 11. UI state

- Conversation loading: skeleton/spinner.
- Conversation empty: hiển thị chưa có cuộc trò chuyện.
- Chat loading history: giữ scroll position khi tải page cũ.
- Sending: disable double tap hoặc hiển thị message đang gửi.
- Send failed: giữ nội dung để retry.
- Received: ưu tiên event socket, sau đó đồng bộ lại bằng REST khi reconnect.

## 12. Retry và giới hạn hiện tại

API hiện chưa có `clientMessageId`/idempotency key. Retry request sau timeout có thể tạo duplicate message; Mobile nên chống double tap và chỉ retry khi chắc request chưa thành công. Có thể bổ sung idempotency sau mà không tự đổi contract hiện tại.

## 13. Security và lỗi

- `401`: access token thiếu/hết hạn, refresh hoặc đăng nhập lại.
- `403`: user không thuộc conversation hoặc không phải chủ message.
- `404`: conversation/message không tồn tại.
- `400`: text rỗng, type hoặc dữ liệu IMAGE/LOCATION không hợp lệ.
- `429`: chờ theo rate limit rồi thử lại.

Mobile không được truy cập conversation của user khác, giả sender, tự chọn recipient, dùng `TechnicianProfile.id` thay cho User ID, tự tạo notification hoặc tự tăng unread count làm nguồn sự thật.

## 14. Chức năng chưa hỗ trợ

Backend hiện đã có IMAGE và LOCATION ngoài TEXT, sửa/thu hồi trong 15 phút, upload ảnh S3 và realtime Socket.IO. Chưa có cursor pagination hoặc client idempotency; Mobile dùng page pagination hiện tại.
