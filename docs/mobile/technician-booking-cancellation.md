# KTV hủy booking: lý do và ảnh minh chứng

Base URL: `/api`. Tất cả API dưới đây cần `Authorization: Bearer <accessToken>` của tài khoản có role `TECHNICIAN`.

## Quyền hủy

- Booking `DIRECT`: chỉ KTV đang được gán (`booking.technicianId`) mới hủy được.
- Booking `OPEN_MARKETPLACE`: chỉ KTV đang được gán **và** có application `SELECTED` mới hủy được.
- Applicant `APPLIED`, `NOT_SELECTED`, `WITHDRAWN`, `DECLINED`, `EXPIRED` không có quyền hủy booking.
- KTV phải còn active, verified và tài khoản active.
- Chỉ hủy ở `PENDING` hoặc `CONFIRMED`. Không hủy `OPEN`, `COMPLETED`, `CANCELLED`.
- Mobile không tự sửa `Booking.status` và không gửi `cancelledBy` hay `userId` trong payload.

## Mã lý do

Mobile map mã sang nhãn tiếng Việt. Không dùng nhãn làm business key.

| reasonCode                     | Ảnh minh chứng            |
| ------------------------------ | ------------------------- |
| `CUSTOMER_NO_SHOW`             | Bắt buộc, ít nhất một ảnh |
| `UNSAFE_SITUATION`             | Bắt buộc, ít nhất một ảnh |
| `INAPPROPRIATE_REQUEST`        | Bắt buộc, ít nhất một ảnh |
| `SERVICE_LOCATION_UNAVAILABLE` | Không bắt buộc            |
| `CUSTOMER_REQUESTED_CANCEL`    | Không bắt buộc            |
| `OTHER`                        | `reasonText` bắt buộc     |

Tối đa 5 ảnh, mỗi ảnh JPEG/PNG/WebP, tối đa 10 MiB.

## 1. Lấy URL upload private

`POST /technician/jobs/:bookingId/cancellation-evidence-upload-url`

```json
{
  "contentType": "image/jpeg",
  "size": 1542321
}
```

Response:

```json
{
  "uploadUrl": "https://...",
  "storageKey": "booking-cancellation/{bookingId}/{currentUserId}/...jpg",
  "expiresIn": 300
}
```

Mobile `PUT` byte ảnh trực tiếp tới `uploadUrl`, dùng đúng `Content-Type` đã yêu cầu. Lặp lại bước này cho từng ảnh, rồi chỉ gửi các `storageKey` nhận từ backend. Không gửi URL ảnh công khai hoặc tự tạo key.

## 2. Xác nhận hủy

`POST /technician/jobs/:bookingId/cancel`

```json
{
  "reasonCode": "INAPPROPRIATE_REQUEST",
  "evidenceStorageKeys": ["booking-cancellation/{bookingId}/{currentUserId}/...jpg"]
}
```

Ví dụ `OTHER`:

```json
{
  "reasonCode": "OTHER",
  "reasonText": "Không thể tiếp cận khu vực theo thông báo của ban quản lý",
  "evidenceStorageKeys": []
}
```

Success:

```json
{
  "bookingId": "uuid",
  "status": "CANCELLED",
  "cancellation": {
    "actor": "TECHNICIAN",
    "reasonCode": "INAPPROPRIATE_REQUEST",
    "reasonText": null,
    "cancelledAt": "2026-10-06T00:00:00.000Z"
  }
}
```

## Lỗi và retry

- `BOOKING_NOT_FOUND`: booking không tồn tại.
- `NOT_ASSIGNED_TECHNICIAN`: không phải KTV được gán, hoặc profile không còn active/verified.
- `APPLICATION_NOT_SELECTED`: OPEN booking chưa chọn KTV này.
- `BOOKING_ALREADY_CANCELLED`, `BOOKING_ALREADY_COMPLETED`: không retry hủy.
- `EVIDENCE_REQUIRED`: bổ sung ảnh cho lý do bắt buộc.
- `INVALID_EVIDENCE_KEY`: upload lại qua API lấy URL; không tái sử dụng key khác user/booking hoặc key tùy ý.
- `EVIDENCE_LIMIT_EXCEEDED`: giảm còn tối đa 5 ảnh, key không được trùng.

Nếu mất mạng sau khi gửi request, tải lại booking trước khi retry. Một booking chỉ có một cancellation audit; request trùng sau khi đã hủy nhận conflict thay vì tạo bản ghi thứ hai.

## Riêng tư

Ảnh nằm trong private storage, không nằm trong marketplace/open job list/technician card. API hủy không trả URL ảnh. Hiện chỉ chuẩn bị quyền đọc cho uploader và admin ở phase tiếp theo; quyền để customer xem evidence chưa được chốt.
