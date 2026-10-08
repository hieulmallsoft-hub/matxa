# Notifications và Firebase Cloud Messaging

## Dữ liệu backend lưu

`Notification` lưu `id`, `userId`, `type`, `title`, `body`, `actionUrl`, `readAt`, `createdAt`. API luôn lọc theo user đang đăng nhập và không trả FCM token.

`DeviceToken` lưu một FCM token duy nhất (`token` unique), `userId`, `platform` (`ANDROID`, `IOS`, `WEB`), `deviceId`, `createdAt`, `updatedAt`, `lastSeenAt`. Một user có thể có nhiều thiết bị. Đăng ký lại cùng token là idempotent và chuyển token về tài khoản hiện tại.

Firebase Admin được khởi tạo từ `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`; private key chỉ đọc từ environment/secret.

## Auth

Tất cả endpoint yêu cầu `Authorization: Bearer <accessToken>`. `userId` luôn lấy từ token, Mobile không được gửi `userId`.

## In-app notification

### Lấy danh sách

`GET /api/notifications?page=1&limit=20&unreadOnly=false`

Response:

```json
{
  "items": [
    {
      "id": "notification-id",
      "type": "BOOKING_CONFIRMED",
      "title": "Dat lich thanh cong",
      "body": "Lich hen da duoc xac nhan.",
      "actionUrl": "matxa://bookings/booking-id",
      "readAt": null,
      "createdAt": "2026-09-29T10:00:00.000Z"
    }
  ],
  "unreadCount": 1,
  "total": 10,
  "page": 1,
  "limit": 20
}
```

Danh sách mới nhất trước. `unreadOnly=true` lọc các record chưa đọc nhưng `unreadCount` luôn là tổng chưa đọc của user.

### Đánh dấu đã đọc

- `PATCH /api/notifications/{id}/read` — idempotent, chỉ owner.
- `PATCH /api/notifications/read-all` — chỉ cập nhật notification của user hiện tại, trả `{ "updated": number }`.

### Xóa

- `DELETE /api/notifications/{id}` — xóa một notification của owner, trả 204.
- `DELETE /api/notifications` — xóa toàn bộ notification của owner, trả `{ "deleted": number }`.

## FCM Integration

Sau login:

```text
FirebaseMessaging.getToken()
  -> POST /api/notifications/devices
```

Request thực tế:

```json
{
  "token": "fcm-registration-token",
  "platform": "ANDROID",
  "deviceId": "device-id-created-by-mobile"
}
```

Khi Firebase gọi `onNewToken`, gọi lại POST trên; không cần xóa token cũ trước. Khi logout, gọi:

`DELETE /api/notifications/devices`

```json
{ "token": "fcm-registration-token" }
```

Endpoint này chỉ xóa token của chính user. Response đăng ký trả `id`, `platform`, `deviceId`, `createdAt`, `lastSeenAt`.

Backend gửi đến tất cả token active của user. Một token lỗi không làm các thiết bị khác thất bại. Các lỗi `registration-token-not-registered` và `invalid-registration-token` sẽ tự xóa token hỏng.

FCM chỉ được gửi sau khi business event và notification DB đã hoàn tất. Firebase lỗi không rollback booking/chat; notification in-app vẫn còn để Mobile hiển thị.

## Data payload và điều hướng

Mobile đọc `type` và các entity id trong data, sau đó tự map sang màn hình:

| Type                | Data field                    | Mobile action                |
| ------------------- | ----------------------------- | ---------------------------- |
| `BOOKING_CREATED`   | `bookingId`                   | Mở chi tiết booking cho KTV  |
| `BOOKING_CONFIRMED` | `bookingId`                   | Mở chi tiết booking          |
| `BOOKING_CANCELLED` | `bookingId`                   | Mở chi tiết booking          |
| `BOOKING_COMPLETED` | `bookingId`                   | Mở chi tiết booking/đánh giá |
| `CHAT_MESSAGE`      | `conversationId`, `messageId` | Mở cuộc trò chuyện           |
| `TEST`              | `notificationId`, `actionUrl` | Mở notification              |

Push không dùng Android route string làm contract; `actionUrl` chỉ là navigation data hiện có của notification record.

## Booking/chat event hiện có

- Khách tạo booking: KTV nhận `BOOKING_CREATED` (DB + FCM).
- KTV confirm: khách nhận `BOOKING_CONFIRMED`.
- Khách hoặc KTV cancel: bên còn lại nhận `BOOKING_CANCELLED`.
- KTV complete: khách nhận `BOOKING_COMPLETED`.
- Tin nhắn chat: người nhận nhận `CHAT_MESSAGE` khi flow gửi push được bật.

Mỗi service tạo DB notification một lần rồi gửi push; Mobile không tự tạo notification business từ title/body.

## Test push

`POST /api/notifications/test-push` chỉ gửi đến các thiết bị của user hiện tại. Body tùy chọn:

```json
{ "title": "Test", "body": "FCM is working" }
```

Endpoint trả `notificationId`, `deviceCount`, `successCount`, `failureCount`. Đây là endpoint kiểm thử; nên disable hoặc chặn tại production nếu không cần dùng.

## Trạng thái Mobile

- Loading: hiển thị skeleton/spinner; không gửi nhiều request song song cho cùng token.
- Empty: hiển thị trạng thái chưa có thông báo.
- Error 401: refresh token hoặc đăng nhập lại.
- Error 404 khi read/delete: notification đã bị xóa hoặc không thuộc user; tải lại danh sách.
- Error 429: chờ theo `Retry-After`.
- Error 5xx: giữ màn hình và cho phép thử lại.

## Không được làm

- Không gửi `userId` để đăng ký/xóa token hoặc test push người khác.
- Không hiển thị FCM token trong UI, log production hoặc analytics.
- Không xem title/body là notification type; dùng enum type và data payload.
- Không tự tăng/giảm unread badge sau thao tác thất bại; lấy lại `unreadCount` từ API.
- Khi logout phải gọi DELETE device token, rồi mới xóa session local.
