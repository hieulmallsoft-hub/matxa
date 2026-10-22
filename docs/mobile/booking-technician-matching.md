# Mobile: tạo đơn và tự tìm KTV

Mobile dùng luồng **tìm KTV rồi để user chọn KTV**. Backend không dùng bước KTV ứng tuyển.

> Lưu ý: đây là contract của luồng user chọn KTV. Backend cần có endpoint matching và nhận `technicianId` ở bước tạo đơn trước khi mobile tích hợp production.

## Xác thực

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Base URL production:

```text
http://149.28.156.66:5600
```

## 1. Tìm KTV phù hợp

```http
POST /api/marketplace/technicians/matching
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
  "note": "Ghi chú cho KTV"
}
```

### Trường bắt buộc

| Field | Mô tả |
|---|---|
| `items` | Danh sách dịch vụ từ catalog Admin |
| `items[].catalogServiceId` | ID dịch vụ catalog |
| `items[].priceOptionId` | ID gói giá catalog |
| `mode` | `HOME`, `ONSITE` hoặc `ONLINE` |
| `city` | Mã thành phố của địa chỉ đặt dịch vụ |
| `scheduledStart` | Thời gian bắt đầu, phải có timezone và nằm trong tương lai |
| `paymentMethod` | `CASH` hoặc `ONLINE` |

Khi `mode = HOME`, bắt buộc gửi `addressId`. `district`, `note`, `promotionCode` và `applicationDeadlineAt` là tùy chọn.

Ở bước này chưa gửi `technicianId`; field này chỉ gửi sau khi user chọn KTV.

### Response danh sách KTV

Response trả danh sách KTV phù hợp để mobile hiển thị cho user chọn. Mỗi KTV cần có `technicianId`, tên, ảnh, khoảng cách và dịch vụ có thể đặt.

## 2. Tạo đơn sau khi user chọn KTV

Sau khi user chọn một KTV, gọi:

```http
POST /api/bookings
```

Body giữ nguyên thông tin dịch vụ/thời gian và thêm:

```json
{
  "technicianId": "technician-profile-id"
}
```

Backend kiểm tra lại toàn bộ điều kiện trước khi tạo đơn và gửi thông báo `BOOKING_CREATED` cho KTV được chọn.

## 3. Điều kiện lọc KTV

Ngay sau khi tạo đơn, backend kiểm tra từng KTV theo các điều kiện:

- Tài khoản đã được Admin duyệt, đang hoạt động và đã xác thực.
- Có đúng dịch vụ trong `items` và dịch vụ đang bật.
- Hỗ trợ đúng `mode` của đơn.
- Thành phố/quận phù hợp với đơn.
- Có availability bao phủ toàn bộ khoảng thời gian đặt.
- Không có booking `CONFIRMED` bị trùng giờ.

Danh sách trả về được dùng để user chọn KTV. Sau khi tạo đơn, KTV được chọn nhận thông báo loại:

```text
BOOKING_CREATED
```

Thông báo có cả bản lưu trong app và push FCM. Push cần device token hợp lệ; bản lưu trong app vẫn được tạo khi KTV đang tắt máy.

## 4. KTV nhận đơn

Danh sách đơn phù hợp:

```http
GET /api/technician/jobs
```

KTV được chọn nhận đơn và xác nhận bằng API hiện có:

```http
POST /api/technician/jobs/{bookingId}/accept
```

## 5. Hủy đơn

User hủy booking:

```http
PATCH /api/bookings/{bookingId}/cancel
```

## 6. Trạng thái và thông báo

User hủy booking:

```http
PATCH /api/bookings/{bookingId}/cancel
```

KTV được chọn nhận thông báo khi user hủy booking:

```text
BOOKING_CANCELLED
```

Nếu KTV không nhận đơn trong thời hạn, mobile báo user để chọn KTV khác.

## 7. Đồng bộ thông báo

Mobile nên gọi danh sách thông báo khi mở app, resume app và sau khi đăng nhập:

```http
GET /api/notifications
```

Đánh dấu đã đọc theo API notifications hiện có. Không chỉ phụ thuộc FCM vì thiết bị có thể đang tắt máy, mất mạng hoặc bị hệ điều hành trì hoãn push.

## 8. Quy tắc UI

- Không hiển thị lựa chọn `DIRECT` hoặc `OPEN_MARKETPLACE` cho user.
- Sau khi tạo đơn, hiển thị trạng thái “Đang tìm KTV phù hợp”.
- Khi có ứng viên, hiển thị danh sách KTV và nút chọn KTV.
- Khi đã chọn KTV, khóa thao tác chọn ứng viên khác.
- Khi nhận `BOOKING_CANCELLED`, hiển thị trạng thái đơn đã hủy.

## 9. Lấy catalog và gói giá

Trước khi tạo đơn, mobile lấy dịch vụ và gói giá từ:

```http
GET /api/service-catalog
```

Chỉ gửi các `catalogServiceId` và `priceOptionId` còn hoạt động trong response catalog. Không tự gửi tên dịch vụ hoặc giá do client tự nhập.

