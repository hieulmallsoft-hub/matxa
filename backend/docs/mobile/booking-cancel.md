# Cancel Booking API - Mobile Integration

## Endpoint

```http
PATCH /api/bookings/:id/cancel
Authorization: Bearer <access_token>
```

Customer chỉ hủy booking của mình; kỹ thuật viên chỉ hủy booking thuộc mình; Admin có thể hủy booking vận hành. Mobile customer không gửi actor id.

## Request

```json
{
  "reasonCode": "NO_LONGER_NEEDED",
  "reasonText": null
}
```

Reason code ổn định:

- `NO_LONGER_NEEDED`: Không muốn sử dụng dịch vụ nữa.
- `SERVICE_ISSUE`: Vấn đề về dịch vụ.
- `PAYMENT_REFUND_ISSUE`: Vấn đề thanh toán/hoàn tiền.
- `OTHER`: Lý do khác; `reasonText` bắt buộc.

`reason` cũ vẫn được backend nhận để tương thích client cũ. Client mới nên dùng `reasonCode` và `reasonText`.

## State và response

Chỉ `PENDING` và `CONFIRMED` chuyển được sang `CANCELLED`. `COMPLETED` và `CANCELLED` không hủy lại được. Response trả booking đã cập nhật, với `status: "CANCELLED"` và:

```json
{
  "cancellation": {
    "reasonCode": "NO_LONGER_NEEDED",
    "reasonText": null,
    "cancelledAt": "2026-10-01T01:10:00.000Z",
    "cancelledBy": "CUSTOMER"
  }
}
```

Booking không bị xóa khỏi History. Sau khi chuyển `CANCELLED`, booking không còn block Availability; Mobile không tự release slot. Hiện hệ thống không restore lượt promotion khi hủy, và chưa có cancellation cutoff/fee.

## UI và lỗi

Khi xác nhận hủy, disable nút và chỉ cập nhật UI sau khi API thành công. Sau success, ẩn nút hủy/review và reload History/Detail.

- `401`: refresh token hoặc yêu cầu đăng nhập.
- `403/404`: booking không thuộc user hoặc không tồn tại.
- `400`: status không thể hủy hoặc `OTHER` thiếu text.
- `409`: request hủy đồng thời; reload detail, nếu đã `CANCELLED` hiển thị trạng thái cuối cùng.

Không gửi `status`, `cancelledAt`, `cancelledByUserId` hay tự xóa booking.
