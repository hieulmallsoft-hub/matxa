# Hết hạn đơn OPEN chưa có KTV

Đơn marketplace ở trạng thái `OPEN` có thời hạn ứng tuyển mặc định **15 phút**
(`OPEN_BOOKING_APPLICATION_TTL_MINUTES`). Worker backend kiểm tra mỗi phút. Khi
quá hạn mà chưa có KTV nhận:

- Booking chuyển `OPEN` → `EXPIRED`.
- Các hồ sơ ứng tuyển `APPLIED` chuyển → `EXPIRED`.
- Khách nhận notification `BOOKING_EXPIRED`.
- Các KTV đã ứng tuyển cũng nhận notification `BOOKING_EXPIRED`.

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
