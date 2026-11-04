# Khiếu nại booking

Khách gửi khiếu nại cho booking của chính mình khi booking đã có KTV nhận: **`CONFIRMED` (đang diễn ra)**,
`COMPLETED` hoặc `CANCELLED`. Mỗi booking chỉ được tạo một khiếu nại.

- `CONFIRMED`: dùng cho các trường hợp xảy ra ngay trong lúc đơn diễn ra, ví dụ "KTV không liên hệ, không đến".
  Hiện nút **Khiếu nại** ở màn chi tiết đơn đã kết nối (Figma).
- Đơn chưa có KTV (`OPEN`, `PENDING`, `EXPIRED`) không khiếu nại được → `400`.
- Đơn **đang có khiếu nại** sẽ **không tự hoàn thành** sau 24h; admin xử lý khiếu nại rồi mới đóng đơn.

## Upload ảnh minh chứng (tùy chọn)

```http
POST /api/bookings/{bookingId}/complaint-evidence-upload-url
```

```json
{ "contentType": "image/jpeg", "size": 524288 }
```

Upload file vào `uploadUrl` nhận được, giữ lại `storageKey`.

## Gửi khiếu nại

```http
POST /api/bookings/{bookingId}/complaint
```

```json
{
  "reasonCode": "TECHNICIAN_BEHAVIOR",
  "detail": "Mô tả vấn đề gặp phải",
  "contactEmail": "customer@example.com",
  "evidenceStorageKeys": ["booking-complaint/.../image.jpg"]
}
```

`reasonCode` nhận: `SERVICE_ISSUE`, `TECHNICIAN_NO_CONTACT`, `TECHNICIAN_BEHAVIOR`, `SAFETY_ISSUE`, `PAYMENT_ISSUE`, `OTHER`.

Response trả `id`, `bookingId`, `reasonCode`, `status` (`SUBMITTED`), nội dung và danh sách minh chứng. Backend kiểm tra quyền sở hữu booking, trạng thái booking, định dạng/kích thước ảnh và chống gửi trùng.

## API admin xử lý khiếu nại

Admin xem danh sách khiếu nại:

```http
GET /api/admin/complaints?status=SUBMITTED
```

`status` là tùy chọn: `SUBMITTED`, `IN_REVIEW`, `RESOLVED` hoặc `REJECTED`.

Admin cập nhật trạng thái:

```http
PATCH /api/admin/complaints/{complaintId}/status
```

```json
{ "status": "IN_REVIEW" }
```

Chỉ tài khoản có role `ADMIN` được gọi hai API này. Backend trả kèm booking, khách hàng và danh sách ảnh minh chứng để admin xử lý.

## Chat hỗ trợ đơn hàng (giống "Hỗ trợ đơn hàng" của Shopee)

Mỗi khiếu nại có **một khung chat riêng giữa khách và CSKH**, gắn với đúng đơn đó. KTV **không** vào được
khung chat này. Đầu khung chat hiện thông tin đơn, KTV đã đặt và nội dung khiếu nại.

### 1. Gửi khiếu nại → mở chat ngay

`POST /api/bookings/{bookingId}/complaint` trả thêm `conversationId`. Gửi xong, app mở thẳng màn chat bằng id này.

```json
{ "id": "complaint-id", "status": "SUBMITTED", "reasonCode": "TECHNICIAN_NO_CONTACT", "conversationId": "conversation-id" }
```

### 2. Chi tiết đơn: nút "Khiếu nại" hay "Hỗ trợ đơn hàng"

`GET /api/bookings/{bookingId}` có thêm:

| Trường | Dùng để |
|---|---|
| `canComplain` | `true` → hiện nút **Khiếu nại** |
| `complaint` | Khác `null` → đơn đã khiếu nại: hiện trạng thái (`complaint.statusLabel`) và nút **Hỗ trợ đơn hàng** |

```json
"complaint": { "id": "…", "status": "IN_REVIEW", "statusLabel": "Đang xử lý", "reasonCode": "TECHNICIAN_NO_CONTACT", "createdAt": "…", "conversationId": "…" }
```

`complaint.conversationId` có thể `null` với khiếu nại gửi trước khi có tính năng này → gọi API ở mục 3, API tự tạo chat.

### 3. Thông tin đầu khung chat

```http
GET /api/bookings/{bookingId}/complaint
```

```json
{
  "id": "complaint-id",
  "status": "SUBMITTED", "statusLabel": "Đã tiếp nhận",
  "reasonCode": "TECHNICIAN_NO_CONTACT", "reasonLabel": "KTV không liên hệ, không đến",
  "detail": "KTV không đến", "contactEmail": "a@b.com", "createdAt": "…", "evidenceCount": 1,
  "conversationId": "conversation-id",
  "booking": {
    "id": "…", "code": "ECEE5154", "status": "CONFIRMED", "mode": "HOME",
    "scheduledStart": "…", "scheduledEnd": "…", "addressText": "35 Tràng Tiền, Hoàn Kiếm, Hà Nội",
    "paymentMethod": "CASH", "totalAmount": 700000,
    "items": [{ "name": "Massage Dầu", "durationMinutes": 90, "price": 600000 }]
  },
  "technician": { "displayName": "Duc Nguyen", "avatarUrl": null, "averageRating": 4.5, "reviewCount": 2 }
}
```

Gợi ý giao diện đầu chat: thẻ đơn (mã `#ECEE5154`, dịch vụ, giờ, địa chỉ, tổng tiền) + KTV (ảnh, tên, ★) +
thẻ khiếu nại (lý do, nội dung, trạng thái). `404` nếu đơn chưa có khiếu nại.

### 4. Nhắn tin

Dùng các API chat có sẵn với `conversationId`:

- `GET /api/conversations/{conversationId}/messages`, `POST /api/conversations/{conversationId}/messages`
- `POST /api/conversations/{conversationId}/image-upload-url` (gửi thêm ảnh minh chứng)
- `PATCH /api/conversations/{conversationId}/read`

Trong `GET /api/conversations`, chat này có `type: "COMPLAINT"`, `participant` là **MATXXA CSKH** và thêm
`complaint: { id, bookingId, bookingCode, status, statusLabel, reasonCode }` → hiện tiêu đề "Hỗ trợ đơn #ECEE5154".
Có thể lọc riêng bằng `GET /api/conversations?type=COMPLAINT`.

Tin `SYSTEM` trong chat này (đã có sẵn chữ ở `text`, dùng `systemEvent` để chọn kiểu hiển thị):

| `systemEvent` | `text` | Hiển thị |
|---|---|---|
| `COMPLAINT_CREATED` | "Bạn đã gửi khiếu nại. CSKH sẽ phản hồi tại đây." | Dòng giữa màn hình (thẻ khiếu nại đã có ở đầu chat) |
| `SUPPORT_AGENT_JOINED` | "MATXXA CSKH đã tham gia cuộc trò chuyện" | Dòng giữa màn hình |
| `COMPLAINT_STATUS_CHANGED` | "Khiếu nại đã chuyển sang: Đã giải quyết" (+ `complaintStatus`) | Dòng giữa màn hình; cập nhật nhãn trạng thái ở đầu chat |

### 5. Thông báo

| `type` | Khi nào | Bấm vào |
|---|---|---|
| `CHAT_MESSAGE_RECEIVED` (title "MATXXA CSKH", data `conversationType: "COMPLAINT"`) | CSKH trả lời | Mở chat `conversationId` |
| `COMPLAINT_STATUS_CHANGED` | Admin đổi trạng thái khiếu nại. Nội dung "Khiếu nại đơn #ECEE5154: Đã giải quyết". Push data có `complaintId`, `conversationId`, `bookingId` | `actionUrl = matxa://chat/{conversationId}` |
