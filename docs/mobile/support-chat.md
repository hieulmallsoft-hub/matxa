# Mobile: Chat hỗ trợ (CSKH)

Hướng dẫn tích hợp màn **Hỗ trợ** trong app khách hàng: mở chat với CSKH, đọc lịch sử,
gửi tin/ảnh, nhận tin realtime.

## Trả lời nhanh

**1. Dùng API nào?**

| Việc | API |
|---|---|
| Mở chat hỗ trợ (nút "Chat ngay") | `POST /api/conversations/support` |
| Nút "Nhắn để đặt" ở địa điểm | `POST /api/conversations/support` với `{"venueId":"..."}` |
| Kiểm tra đã có chat chưa | `GET /api/conversations?type=SUPPORT` |
| Đọc lịch sử | `GET /api/conversations/{id}/messages?page=1&limit=30` |
| Gửi tin chữ | `POST /api/conversations/{id}/messages` |
| Gửi ảnh | `POST /api/conversations/{id}/image-upload-url` → `PUT` lên S3 → `POST .../messages` |
| Đánh dấu đã đọc | `PATCH /api/conversations/{id}/read` |
| Realtime | Socket.IO namespace `/chat`, sự kiện `message.created` |
| Biết chat đã kết thúc | Socket `conversation.ended`, hoặc API trả `404` |

Mọi request dùng `Authorization: Bearer <accessToken của khách>`. App **không bao giờ**
gửi ID admin, ID KTV hay `senderId`: backend lấy người gửi từ token.

**2. Có tách thành nhiều cuộc trò chuyện nhỏ không?**

**Có, theo từng lần hỗ trợ.** Mỗi lần hỗ trợ là một cuộc trò chuyện. Tại một thời điểm, mỗi
khách chỉ có **tối đa một** cuộc đang mở: gọi "Chat ngay" nhiều lần trong lúc đang mở vẫn trả về
cùng một `id`. Vì vậy mục **"Cuộc trò chuyện gần đây"** trong Figma chỉ có tối đa **một dòng**.

Cuộc trò chuyện **kết thúc** khi:
- nhân viên CSKH bấm **Kết thúc hỗ trợ** trên web admin, hoặc
- **24 giờ** không ai nhắn tin.

Kết thúc là **xóa hẳn**: tin nhắn, ảnh và thông báo của cuộc đó đều bị xóa. Lần sau khách bấm
"Chat ngay", backend tạo cuộc mới với `id` mới và lời chào mới.

Chat hỗ trợ tách biệt với chat theo đơn (khách ↔ KTV, `type: BOOKING`). Màn Hỗ trợ
không dùng endpoint chat booking.

**3. Lịch sử lưu ở đâu, có mất không?**

- **Trong lúc cuộc trò chuyện còn mở**, lịch sử lưu trên server: đóng app, đăng xuất, đổi máy
  **không mất**.
- **Khi cuộc trò chuyện kết thúc**, lịch sử bị xóa vĩnh viễn ở cả phía khách và admin.
  App phải xóa tin đã lưu tạm (cache) của cuộc đó.
- Khách bấm xoá cuộc trò chuyện (`DELETE /api/conversations/{id}`) chỉ **ẩn** ở phía khách,
  không kết thúc cuộc trò chuyện. Mở lại chat hoặc có tin mới thì hiện lại đầy đủ lịch sử.

## Luồng màn hình (theo Figma)

```
Cài đặt → Hỗ trợ
  ├─ GET /api/conversations?type=SUPPORT
  │    ├─ []        → chỉ hiện thẻ "Hỗ trợ nhanh – Chat ngay"
  │    └─ [1 phần tử] → hiện thêm 1 dòng ở "Cuộc trò chuyện gần đây"
  │                    (lastMessage + unreadCount)
  ├─ Bấm "Chat ngay" hoặc dòng trò chuyện
  │    └─ POST /api/conversations/support  → lấy id
  └─ Màn chat
       ├─ GET  .../messages      (lịch sử)
       ├─ Socket conversation.open (realtime)
       ├─ PATCH .../read         (khi đang xem)
       └─ POST .../messages      (gửi)
```

Gọi thẳng `POST /api/conversations/support` khi bấm "Chat ngay" là đủ, không cần kiểm tra
trước đã có chat hay chưa.

## 1. Mở chat

```http
POST /api/conversations/support
Authorization: Bearer <token>
```

Không cần body. Lần đầu backend tạo cuộc trò chuyện và tự thêm lời chào; các lần sau trả lại
cuộc cũ.

```json
{
  "id": "conversation-uuid",
  "type": "SUPPORT",
  "supportCustomerId": "customer-user-uuid",
  "bookingId": null,
  "participant": { "id": "support", "displayName": "MATXXA CSKH", "avatarUrl": null, "role": "ADMIN" },
  "lastMessageAt": "2026-11-02T08:00:00.000Z"
}
```

- Dùng `id` cho mọi API bên dưới và cho socket.
- `participant` là thông tin hiển thị header chat. `participant.id = "support"` không phải UUID tài khoản.
- KTV gọi API này nhận `403`.

**Nút "Nhắn để đặt"** ở chi tiết địa điểm gọi cùng API, kèm `venueId`:

```json
{ "venueId": "venue-uuid" }
```

Backend mở chat như trên và gửi thay khách tin
`"Mình muốn đặt lịch tại <tên địa điểm> (<địa chỉ>)."`. Response có thêm `inquiryMessage`
(tin vừa gửi). Mở màn chat bằng `id` như bình thường.

## 2. Danh sách (mục "Cuộc trò chuyện gần đây")

```http
GET /api/conversations?type=SUPPORT
```

Response là **mảng** (không có `items`), tối đa 1 phần tử:

```json
[
  {
    "id": "conversation-uuid",
    "type": "SUPPORT",
    "participant": { "id": "support", "displayName": "MATXXA CSKH", "avatarUrl": null, "role": "ADMIN" },
    "lastMessage": { "id": "message-uuid", "type": "TEXT", "text": "Chào bạn!", "createdAt": "2026-11-02T08:00:00.000Z" },
    "lastMessageAt": "2026-11-02T08:00:00.000Z",
    "unreadCount": 1
  }
]
```

Mảng rỗng: khách chưa mở chat, hoặc cuộc trước đã kết thúc.

## 3. Lịch sử tin nhắn

```http
GET /api/conversations/{id}/messages?page=1&limit=30
```

`limit` tối đa 100. Response:

```json
{
  "items": [
    {
      "id": "message-uuid",
      "conversationId": "conversation-uuid",
      "senderId": "admin-user-uuid",
      "sender": { "id": "admin-user-uuid", "displayName": "Lan CSKH", "avatarUrl": null, "role": "ADMIN" },
      "type": "TEXT",
      "text": "Bạn cần hỗ trợ gì ạ?",
      "mediaUrl": null,
      "recalledAt": null,
      "createdAt": "2026-11-02T08:05:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 30
}
```

- `items` **mới nhất trước**. Đảo thứ tự để hiển thị cũ ở trên.
- Kéo lên đầu danh sách → tăng `page` để tải tin cũ hơn. Gộp theo `id` để không trùng.
- Phân biệt người gửi:

| Điều kiện | Hiển thị |
|---|---|
| `type = "SYSTEM"` | Theo `systemEvent` (xem mục 6). Kiểm tra trước tiên. |
| `senderId` = ID khách đang đăng nhập | Bong bóng của khách (bên phải) |
| `sender.role = "ADMIN"` | Bong bóng CSKH (bên trái), tên hiển thị "MATXXA CSKH" |

- `recalledAt` khác `null`: hiện "Tin nhắn đã thu hồi".
- Tin ảnh có `mediaUrl` là link ký tạm thời. Ảnh không tải được (link hết hạn) thì gọi lại
  API lịch sử để lấy link mới.

## 4. Gửi tin chữ

```http
POST /api/conversations/{id}/messages
Content-Type: application/json

{ "type": "TEXT", "text": "Mình muốn massage chân và giãn cơ." }
```

Trả về tin vừa lưu (cùng dạng một phần tử trong `items`). Tin được lưu vào database trước
khi trả về, nên hiển thị luôn từ response.

## 5. Gửi ảnh (nút Thư viện / Máy ảnh)

Ba bước:

**a.** Xin URL upload:

```http
POST /api/conversations/{id}/image-upload-url

{ "fileName": "photo.jpg", "contentType": "image/jpeg", "size": 120000 }
```

Response có `uploadUrl` và `mediaKey`.

**b.** Upload file thẳng lên S3:

```http
PUT <uploadUrl>
Content-Type: image/jpeg     ← đúng contentType ở bước a
<binary>
```

**Không** gắn Bearer token vào request S3.

**c.** Gửi tin ảnh:

```json
{ "type": "IMAGE", "mediaKey": "<mediaKey nhận ở bước a>" }
```

Dùng nguyên `mediaKey` backend trả về, không tự ghép. Hỗ trợ JPG, PNG, WebP, tối đa 10 MB.

## 6. Tin hệ thống (lời chào, CSKH tham gia)

Tin `type: "SYSTEM"` có thêm trường `systemEvent`; `text` đã là nội dung hiển thị sẵn.

| `systemEvent` | Khi nào xuất hiện | Hiển thị theo Figma |
|---|---|---|
| `SUPPORT_WELCOME` | Tự tạo khi cuộc trò chuyện được mở lần đầu | Bong bóng CSKH: "MATXXA CSKH có thể giúp gì cho bạn?" |
| `SUPPORT_AGENT_JOINED` | Ngay trước tin trả lời đầu tiên của admin | Dòng nhỏ giữa màn hình: "MATXXA CSKH đã tham gia cuộc trò chuyện" |

Lưu ý: `SUPPORT_WELCOME` có `senderId` là ID khách nhưng **không phải** tin khách gửi.
Luôn kiểm tra `type`/`systemEvent` trước khi xét `senderId`.

Dòng "Thời gian phản hồi lâu hơn bình thường…" trong Figma là **chữ cố định trên app**,
backend không gửi. Hiện chưa có chatbot tự trả lời; mọi câu trả lời do nhân viên CSKH gửi.

## 7. Đã đọc

```http
PATCH /api/conversations/{id}/read
```

Không cần body. Gọi khi mở màn chat và mỗi khi nhận tin mới trong lúc đang xem.
`unreadCount` ở mục 2 sẽ về 0.

## 8. Realtime (Socket.IO)

```js
const socket = io('https://<api-host>/chat', { auth: { token: accessToken } });

socket.emit('conversation.open', { conversationId });   // khi vào màn chat
socket.on('message.created', (message) => { /* gộp theo message.id */ });
socket.emit('conversation.close', { conversationId });  // khi rời màn chat
```

- Chỉ gắn tin vào màn hình có đúng `message.conversationId`.
- Tin admin trả lời từ web cũng phát `message.created`.
- Với lần trả lời đầu tiên của admin, socket phát tin `SUPPORT_AGENT_JOINED` **trước**, rồi
  mới tới tin trả lời.
- Token hết hạn: socket phát `auth.error` rồi ngắt; làm mới token và kết nối lại.
- Socket **không** giữ tin khi máy offline. Khi app resume hoặc reconnect, gọi lại API lịch sử
  (mục 3) để bù tin bị lỡ.

### Chat kết thúc

```js
socket.on('conversation.ended', ({ conversationId, reason }) => {
  // reason: "AGENT_ENDED" (CSKH bấm Kết thúc) | "IDLE" (24 giờ không ai nhắn)
});
```

Khi nhận sự kiện này cho cuộc đang mở:
1. Xóa tin đã lưu tạm của `conversationId` và bỏ dòng đó khỏi "Cuộc trò chuyện gần đây".
2. Nếu khách đang ở màn chat: hiện "Cuộc trò chuyện đã kết thúc" và khóa ô nhập. Khi khách muốn
   nhắn tiếp, gọi lại `POST /api/conversations/support` để lấy cuộc **mới** rồi mở bằng `id` mới.

Nếu app offline lúc kết thúc thì sẽ không nhận được sự kiện. Khi đó mọi API với `id` cũ trả
`404` ("Cuoc tro chuyen khong ton tai"); app xử lý giống như nhận `conversation.ended`.
**Không giữ `id` cũ lâu dài**: mỗi lần vào màn Hỗ trợ, gọi `POST /api/conversations/support`
để lấy `id` hiện tại.

## 9. Push notification

Khi app chạy nền, khách nhận push loại `CHAT_MESSAGE_RECEIVED`, data gồm:

```json
{ "conversationId": "conversation-uuid", "messageId": "message-uuid", "conversationType": "SUPPORT" }
```

Không có `bookingId`. Chạm push → mở màn chat Hỗ trợ theo `conversationId`. Nếu cuộc đó
đã kết thúc (API trả `404`), mở màn Hỗ trợ bình thường.
Push cần device token đã đăng ký và FCM cấu hình đúng; tin vẫn được lưu khi máy offline.

## 10. Quyền truy cập và lỗi thường gặp

| Tình huống | Kết quả |
|---|---|
| Khách xem/gửi vào cuộc trò chuyện của khách khác | `403` |
| Tài khoản KTV gọi các API hỗ trợ | `403` |
| `venueId` không tồn tại hoặc địa điểm đã ẩn | `404`, không tạo/gửi gì |
| Gọi API với `id` của cuộc đã kết thúc | `404` "Cuoc tro chuyen khong ton tai": mở cuộc mới bằng `POST /api/conversations/support` |
| Gửi tin `type: "SYSTEM"` từ app | `400` (app không được gửi tin hệ thống) |
| `mediaKey` không phải key backend cấp cho đúng cuộc trò chuyện này | `400` |
| Tin chữ rỗng | `400` |
