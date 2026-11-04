# Thông tin nền tảng và quy định đặt lịch

Admin chỉnh trong web Admin → **Cấu hình hệ thống** (mục *Thông tin hệ thống* và *Cấu hình Đặt lịch*). Mobile đọc qua một API công khai, không cần token.

## 1. Đọc cấu hình

```http
GET /api/settings/public
```

```json
{
  "brandName": "Psyocore",
  "hotline": "0901 234 567",
  "supportEmail": "hotro@matxa.vn",
  "minAdvanceHours": 1,
  "maxDispatchRadiusKm": 15
}
```

| Trường | Ý nghĩa | Gợi ý dùng trên app |
|---|---|---|
| `brandName` | Tên thương hiệu | Màn Giới thiệu/Liên hệ |
| `hotline` | Hotline CSKH, có thể là chuỗi rỗng | Nút gọi hotline; ẩn nếu rỗng |
| `supportEmail` | Email CSKH, có thể là chuỗi rỗng | Nút gửi email; ẩn nếu rỗng |
| `minAdvanceHours` | Khách phải đặt trước ít nhất bấy nhiêu giờ. `0` = không giới hạn | Khoá các giờ sớm hơn `now + minAdvanceHours` trong bộ chọn giờ |
| `maxDispatchRadiusKm` | Đơn tại nhà chỉ gợi ý/gửi cho KTV trong bán kính này. `0` = không giới hạn | Chỉ để hiển thị nếu cần, backend tự lọc |

Gọi lại khi mở màn đặt lịch, vì Admin có thể đổi bất cứ lúc nào.

## 2. Lỗi mới khi đặt lịch

Backend luôn kiểm tra lại, kể cả khi app đã chặn ở bộ chọn giờ.

| API | Khi nào | Response |
|---|---|---|
| `POST /api/bookings/quote`, `POST /api/bookings`, `POST /api/bookings/matching-technicians`, `POST /api/bookings/open` | Giờ bắt đầu sớm hơn `minAdvanceHours` | `400` `Vui long dat lich truoc it nhat {X} gio` |
| KTV ứng tuyển / xem đơn mở | KTV cách địa chỉ khách xa hơn `maxDispatchRadiusKm` | `403` `KTV ngoai ban kinh phuc vu cua don` |

Với bán kính:
- Danh sách KTV gợi ý cho khách tự bỏ các KTV ở xa hơn bán kính.
- KTV ở xa không nhận thông báo "Yêu cầu mới" và không thấy đơn trong tab Nhận việc.
- Chỉ áp dụng cho đơn **tại nhà** (có toạ độ). KTV chưa cập nhật vị trí vẫn nhận đơn như trước.
