# Tự hoàn thành booking

Booking ở trạng thái `CONFIRMED` sẽ được backend tự chuyển sang `COMPLETED` sau 24 giờ kể từ `scheduledEnd`. Worker chạy định kỳ mỗi phút và cập nhật có điều kiện, nên nếu KTV đã bấm hoàn thành trước đó thì không tạo thêm lần chuyển trạng thái.

Sau khi tự hoàn thành, khách và KTV nhận notification:

```json
{
  "type": "BOOKING_AUTO_COMPLETED",
  "bookingId": "uuid",
  "automatic": "true"
}
```

Mobile hiển thị trạng thái hoàn thành và cho khách đánh giá theo flow `COMPLETED`. Không tự chuyển `PENDING`, `OPEN`, `CANCELLED` hoặc `EXPIRED` sang `COMPLETED`.
