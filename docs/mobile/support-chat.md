# Mobile: chat hỗ trợ khách–admin

Mỗi khách có **một** hội thoại `SUPPORT` dùng chung với toàn bộ CSKH, không cần booking.
Khách tự mở từ app, hoặc admin mở trong web **Tin nhắn CSKH → Tạo cuộc trò chuyện**;
cả hai cách đều ra cùng một hội thoại. Mobile không truyền ID admin hay KTV.
Các request dùng Bearer access token của khách.

## Mở chat hỗ trợ (nút "Chat ngay")

```http
POST /api/conversations/support
```

Không cần body. Backend lấy khách từ token, trả hội thoại hỗ trợ của khách: lần đầu thì
tạo mới, các lần sau trả lại đúng hội thoại cũ kèm lịch sử. Gọi nhiều lần vẫn an toàn.

```json
{
  "id": "conversation-uuid",
  "type": "SUPPORT",
  "supportCustomerId": "customer-user-uuid",
  "bookingId": null,
  "participant": {"id":"support","displayName":"MATXXA CSKH","avatarUrl":null,"role":"ADMIN"},
  "lastMessageAt": "2026-11-02T08:00:00.000Z"
}
```

Dùng `id` cho các API tin nhắn, đã đọc và socket bên dưới. KTV gọi API này nhận `403`.
Nút "Nhắn để đặt" ở địa điểm gọi cùng API với `{"venueId":"..."}`: backend gửi thêm tin
hỏi đặt lịch tại địa điểm đó, trả về trong `inquiryMessage` (xem [venues.md](venues.md)).
Admin gọi kèm `{"customerId":"UUID khách"}`.

## Tin hệ thống: lời chào và CSKH tham gia

Tin `type: "SYSTEM"` trong hội thoại hỗ trợ có thêm `systemEvent`, `text` là nội dung hiển thị sẵn:

| `systemEvent` | Khi nào | Gợi ý hiển thị (Figma) |
|---|---|---|
| `SUPPORT_WELCOME` | Tự tạo khi hội thoại được mở lần đầu | Bong bóng CSKH: "MATXXA CSKH có thể giúp gì cho bạn?" |
| `SUPPORT_AGENT_JOINED` | Ngay trước tin trả lời đầu tiên của admin | Dòng giữa màn hình: "MATXXA CSKH đã tham gia cuộc trò chuyện" |

Hiển thị theo `systemEvent`, không theo `senderId`: tin `SUPPORT_WELCOME` có `senderId` là ID
khách nhưng không phải tin khách gửi. Dòng "thời gian phản hồi lâu hơn bình thường" trong
Figma là chữ cố định trên app, backend không gửi.

## Hộp thư và lịch sử

```http
GET /api/conversations?type=SUPPORT
```

Response là mảng, không có wrapper `items`:

```json
[
  {
    "id": "conversation-uuid",
    "type": "SUPPORT",
    "supportCustomerId": "customer-user-uuid",
    "bookingId": null,
    "participant": {"id":"support","displayName":"MATXXA CSKH","avatarUrl":null,"role":"ADMIN"},
    "lastMessage": {"id":"message-uuid","senderId":"admin-user-uuid","type":"TEXT","text":"Chào bạn!","createdAt":"2026-11-02T08:00:00.000Z"},
    "lastMessageAt": "2026-11-02T08:00:00.000Z",
    "unreadCount": 1
  }
]
```

Mảng rỗng nghĩa là khách chưa từng mở chat (hoặc lịch sử đã bị xoá do không hoạt động).
Bấm "Chat ngay" gọi `POST /api/conversations/support` để mở.
`participant.id = support` là định danh hiển thị CSKH, không phải UUID tài khoản.
Không sử dụng endpoint tạo chat booking cho màn Hỗ trợ.

```http
GET /api/conversations/{conversationId}/messages?page=1&limit=30
```

Response `{items,total,page,limit}`, `items` mới nhất trước. Đảo thứ tự để hiển thị
cũ trước, tăng `page` để đọc lịch sử cũ và gộp theo `id` để tránh trùng.
`senderId` bằng ID khách đăng nhập là tin của khách; `sender.role = ADMIN` là tin CSKH.
`sender` có `id`, `displayName`, `avatarUrl`, `role`, giúp nhận biết admin đã gửi.
Tin có `recalledAt` hiển thị đã thu hồi. Tin ảnh có `mediaUrl` ký tạm thời; hết hạn
thì tải lại lịch sử để lấy URL mới.

## Gửi tin và ảnh

```http
POST /api/conversations/{conversationId}/messages
Content-Type: application/json
```

```json
{"type":"TEXT","text":"Mình cần tư vấn dịch vụ massage."}
```

Không gửi `senderId`, `bookingId` hay ID admin. Backend lấy người gửi từ token
và lưu tin vào database trước khi trả kết quả. Admin dùng cùng API để trả lời.

Để gửi ảnh, trước tiên gọi:

```http
POST /api/conversations/{conversationId}/image-upload-url
```

```json
{"fileName":"photo.jpg","contentType":"image/jpeg","size":120000}
```

Lấy `uploadUrl`, `mediaKey` từ response. Upload file bằng `PUT uploadUrl`, header
`Content-Type` đúng như trên, không gắn Bearer token vào request S3. PUT thành công
thì gọi API gửi tin với body:

```json
{"type":"IMAGE","mediaKey":"chat/conversation-uuid/customer-user-uuid/photo.jpg"}
```

Dùng chính xác `mediaKey` nhận từ API, không tự ghép key. Hỗ trợ JPG, PNG, WebP tối đa 10 MB.

## Đã đọc và realtime

```http
PATCH /api/conversations/{conversationId}/read
```

Không cần body. Gọi khi đang mở và xem tin. Cursor đọc của admin riêng với khách.

Socket.IO namespace `/chat`, xác thực `auth: {token: accessToken}`. Khi mở màn hình,
gửi `conversation.open` với `{conversationId}`; nghe `message.created` và gộp theo `id`.
Với tin trả lời đầu tiên của admin, socket phát tin `SUPPORT_AGENT_JOINED` trước rồi mới
đến tin trả lời. Response REST của admin có thêm `joinMessage`; mobile không cần dùng trường này.
Khi rời màn hình gửi `conversation.close`. Tin admin gửi REST trên web cũng phát
`message.created`. Chỉ gắn tin vào màn hình có đúng `conversationId`.

Khi resume/reconnect, tải lại REST vì socket không giữ tin lúc thiết bị offline.
Push `CHAT_MESSAGE_RECEIVED` có `conversationId`, `messageId`, `conversationType: SUPPORT`,
không có `bookingId`. Chạm push thì mở màn hỗ trợ theo `conversationId`.
Push cần device token hợp lệ và cấu hình FCM; tin vẫn lưu khi thiết bị offline.

## Lưu trữ và quyền truy cập

Hội thoại/thành viên/tin lưu tại database server (`conversations`, `conversation_members`,
`messages`), ảnh ở S3. Đóng app, đăng xuất, đổi máy không xóa lịch sử.

**Tự xoá:** hội thoại hỗ trợ không có tin mới trong `SUPPORT_CHAT_RETENTION_DAYS` ngày
(mặc định 90) bị xoá hẳn cùng toàn bộ tin, cả phía khách lẫn admin. Khách nhắn lại sau đó
sẽ bắt đầu hội thoại mới có lời chào. Đặt biến này bằng `0` để giữ vĩnh viễn.

`DELETE /api/conversations/{id}` chỉ ẩn ở phía khách. Khách mở lại chat hoặc có tin mới
sẽ hiện lại hội thoại hỗ trợ với lịch sử đầy đủ (trừ khi đã bị tự xoá).

Chỉ chính khách và admin được xem/gửi/upload. Khách khác hoặc KTV nhận `403`.
Chức năng hiện tại không có chatbot tự trả lời; lời chào là tin hệ thống cố định.
