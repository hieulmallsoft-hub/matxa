# Hết hạn đơn chưa có KTV nhận

Đơn `OPEN_MARKETPLACE` ở trạng thái `OPEN` và đơn `DIRECT` ở trạng thái `PENDING`
đều có thời hạn chờ KTV mặc định **15 phút** (`OPEN_BOOKING_APPLICATION_TTL_MINUTES`).
Worker backend kiểm tra mỗi phút. Khi quá hạn mà chưa có KTV nhận:

- Booking chuyển `OPEN` → `EXPIRED`.
- Booking `DIRECT` chuyển `PENDING` → `EXPIRED`.
- Các hồ sơ ứng tuyển `APPLIED` chuyển → `EXPIRED`.
- Khách nhận notification `BOOKING_EXPIRED`.
- KTV được gán trực tiếp hoặc các KTV đã ứng tuyển cũng nhận notification `BOOKING_EXPIRED`.

Payload notification có dạng:

```json
{
  "type": "BOOKING_EXPIRED",
  "bookingId": "uuid"
}
```

Mobile nên refresh chi tiết booking sau khi nhận notification để hiển thị trạng
thái `EXPIRED`. Server có thể ghi đè thời hạn bằng biến môi trường
`OPEN_BOOKING_APPLICATION_TTL_MINUTES` nếu nghiệp vụ cần giá trị khác.
