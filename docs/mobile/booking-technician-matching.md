# Mobile: tìm KTV và đặt lịch

> Cập nhật luồng hiện tại: `POST /api/bookings` lưu KTV khách yêu cầu vào
> `requestedTechnicianId` và tạo đơn `OPEN_MARKETPLACE` để các KTV phù hợp ứng
> tuyển. Xem [phân biệt người nhận yêu cầu](booking-request-recipient.md) để hiển
> thị “Khách đặt bạn” / “Yêu cầu mới”. Các mô tả tạo đơn trực tiếp `PENDING`
> bên dưới là tài liệu luồng cũ.

Mobile dùng một luồng duy nhất: user chọn thông tin dịch vụ, xem danh sách KTV phù hợp, chọn một KTV rồi đặt lịch. Mobile không gửi `assignmentMode` và không dùng luồng KTV ứng tuyển.

## Xác thực

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Base URL production:

```text
http://149.28.156.66:5600
```

## 1. Hiển thị danh sách KTV

Khi user mở nhóm dịch vụ hoặc thay đổi bộ lọc, gọi lại cùng API:

```http
POST /api/bookings/matching-technicians
```

Body:

```json
{
  "items": [
    {
      "catalogServiceId": "catalog-service-id",
      "priceOptionId": "catalog-price-option-id"
    }
  ],
  "mode": "HOME",
  "city": "HN",
  "district": "HN-CAU-GIAY",
  "scheduledStart": "2026-10-25T10:00:00+07:00",
  "addressId": "customer-address-id",
  "paymentMethod": "CASH",
  "search": "Nguyễn",
  "sort": "distance",
  "latitude": 21.0285,
  "longitude": 105.8542
}
```

`items`, `mode`, `city`, `scheduledStart` và `paymentMethod` là bắt buộc. Khi `mode = HOME`, bắt buộc có `addressId`. `district`, `note`, `promotionCode` và `applicationDeadlineAt` là tùy chọn.

Các field lọc tùy chọn:

| Field | Ý nghĩa |
|---|---|
| `search` | Lọc theo tên hiển thị của KTV |
| `sort` | `distance`, `rating` hoặc `availability` |
| `latitude`, `longitude` | Tọa độ để tính khoảng cách; nếu không gửi, backend dùng tọa độ của `addressId` khi đặt tại nhà |

Mỗi lần user đổi dịch vụ, nhập tên, đổi khu vực, đổi thời gian hoặc đổi cách sắp xếp, mobile gửi lại request với toàn bộ giá trị hiện tại. Không cần gọi thêm API tìm KTV khác.

Backend chỉ trả KTV đã được duyệt, đang hoạt động, có dịch vụ và mode phù hợp, có lịch rảnh bao phủ toàn bộ thời gian đặt và không bị trùng booking `CONFIRMED`.

Response:

```json
{
  "items": [
    {
      "technicianId": "technician-profile-id",
      "displayName": "Nguyễn Văn A",
      "avatarUrl": "https://...",
      "city": "HN",
      "district": "HN-CAU-GIAY",
      "distanceKm": 2.4,
      "rating": 4.8,
      "reviewCount": 15
    }
  ],
  "total": 1
}
```

## 2. User bấm “Đặt lịch”

Sau khi user chọn một KTV, gọi:

```http
POST /api/bookings
```

Body:

```json
{
  "technicianId": "technician-profile-id",
  "items": [
    {
      "catalogServiceId": "catalog-service-id",
      "priceOptionId": "catalog-price-option-id"
    }
  ],
  "mode": "HOME",
  "city": "HN",
  "district": "HN-CAU-GIAY",
  "scheduledStart": "2026-10-25T10:00:00+07:00",
  "addressId": "customer-address-id",
  "paymentMethod": "CASH",
  "note": "Ghi chú cho KTV"
}
```

Backend kiểm tra lại điều kiện, **tạo đơn và gán đơn cho đúng KTV đã chọn** ở trạng thái chờ KTV xác nhận. Đơn phải xuất hiện trong danh sách việc của KTV qua `GET /api/technician/jobs`. Backend đồng thời lưu thông báo `BOOKING_CREATED` để báo cho KTV; notification không thay thế cho bản ghi đơn.

Không gửi `assignmentMode` hoặc `serviceIds`.

## 3. Thông báo cho KTV

Khi tạo booking thành công, backend lưu thông báo `BOOKING_CREATED` cho tài khoản KTV và gửi push FCM nếu KTV đã đăng ký device token. Thông báo trong hệ thống vẫn được lưu khi KTV không mở app, mất mạng hoặc tắt máy.

Khi app mở lại, mobile KTV đồng bộ:

```http
GET /api/notifications
```

KTV xem đơn:

```http
GET /api/technician/jobs
```

KTV xác nhận đơn:

```http
POST /api/technician/jobs/{bookingId}/accept
```

## 4. Hủy booking

User hủy đơn:

```http
PATCH /api/bookings/{bookingId}/cancel
```

KTV nhận thông báo `BOOKING_CANCELLED` qua bản lưu trong app và push FCM nếu có device token.

## 5. Catalog dịch vụ

Trước khi matching và đặt lịch, mobile lấy dịch vụ/gói giá đang hoạt động từ:

```http
GET /api/service-catalog
```

Chỉ gửi `catalogServiceId` và `priceOptionId` lấy từ catalog.

## 6. Hoa hồng và số dư ví KTV

Tỷ lệ do Admin cấu hình tại **Cấu hình hệ thống → Chính sách & Hoa hồng KTV**. Ví dụ Admin đặt KTV nhận `75%` thì phần sàn là `25%`.

Khi KTV nhận đơn hoặc khách chọn KTV marketplace, backend trừ ngay phần sàn khỏi ví ký quỹ của KTV; không chờ đến khi booking hoàn thành.

```text
Phí trừ ví = giá trị dịch vụ × (100 - tỷ lệ KTV nhận) / 100
Thu nhập KTV = giá trị dịch vụ - phí trừ ví
```

Ví dụ giá trị dịch vụ `600.000đ`, KTV nhận `75%`:

```text
Trừ ví: 150.000đ
Thu nhập KTV: 450.000đ
```

Nếu ví không đủ số dư, thao tác nhận/chọn KTV bị từ chối và booking không được xác nhận. Giao dịch trừ tiền được lưu trong lịch sử ví với mã tham chiếu booking.

## 7. API không dùng trong luồng mới

Mobile không dùng các API marketplace cũ:

```text
POST /api/bookings/open
POST /api/bookings/{bookingId}/select-technician
POST /api/technician/jobs/{bookingId}/apply
POST /api/technician/jobs/{bookingId}/withdraw
```

## 8. Quy trình test trên Swagger

### Bước 1: KTV tạo khoảng thời gian rảnh

Đăng nhập Swagger bằng token KTV:

```http
POST /api/technician/availability
```

```json
{
  "startAt": "2026-12-01T09:00:00+07:00",
  "endAt": "2026-12-01T12:00:00+07:00"
}
```

### Bước 2: Customer tìm KTV

Đăng nhập bằng token customer:

```http
POST /api/bookings/matching-technicians
```

Nếu `items` rỗng thì không có KTV nào thỏa điều kiện dịch vụ, khu vực, mode và availability.

### Bước 3: Customer đặt KTV

Gửi các ID thực tế từ catalog/matching và thêm `technicianId`:

```http
POST /api/bookings
```

Booking thành công trả về `201`, `status: "PENDING"` và `bookingId`. `PENDING` nghĩa là đơn đang chờ KTV xác nhận.

### Bước 4: KTV xem và nhận đơn

```http
GET /api/technician/jobs
POST /api/technician/jobs/{bookingId}/accept
```

Matching dùng token customer; availability/jobs/accept dùng token KTV.
