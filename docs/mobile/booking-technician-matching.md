# Mobile: tạo đơn và tự tìm KTV

Mobile dùng **một luồng tạo đơn duy nhất**. Người dùng không chọn `DIRECT`, `OPEN_MARKETPLACE` và không gửi `technicianId`. Backend tự tìm các KTV phù hợp rồi gửi thông báo để KTV ứng tuyển.

## Xác thực

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Base URL production:

```text
http://149.28.156.66:5600
```

## 1. Tạo đơn

```http
POST /api/bookings
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

Không gửi các field sau:

```text
assignmentMode
technicianId
serviceIds
```

### Response thành công

Đơn mới ở trạng thái mở để tìm KTV. Backend sẽ trả `bookingId`, thời gian, các item và tổng tiền. Response có thể chứa `assignmentMode: OPEN_MARKETPLACE` vì đây là trạng thái nội bộ; mobile không cần xử lý hoặc gửi lại field này.

## 2. Backend tự tìm KTV

Ngay sau khi tạo đơn, backend kiểm tra từng KTV theo các điều kiện:

- Tài khoản đã được Admin duyệt, đang hoạt động và đã xác thực.
- Có đúng dịch vụ trong `items` và dịch vụ đang bật.
- Hỗ trợ đúng `mode` của đơn.
- Thành phố/quận phù hợp với đơn.
- Có availability bao phủ toàn bộ khoảng thời gian đặt.
- Không có booking `CONFIRMED` bị trùng giờ.

KTV phù hợp nhận thông báo loại:

```text
OPEN_BOOKING_AVAILABLE
```

Thông báo có cả bản lưu trong app và push FCM. Push cần device token hợp lệ; bản lưu trong app vẫn được tạo khi KTV đang tắt máy.

## 3. KTV xem đơn và ứng tuyển

Danh sách đơn phù hợp:

```http
GET /api/technician/jobs
```

KTV ứng tuyển:

```http
POST /api/technician/jobs/{bookingId}/apply
```

Không gửi body. Request dùng access token của tài khoản KTV.

KTV có thể rút ứng tuyển khi đơn vẫn còn mở:

```http
POST /api/technician/jobs/{bookingId}/withdraw
```

## 4. User xem ứng viên và chọn KTV

Mobile user lấy chi tiết booking bằng:

```http
GET /api/bookings/{bookingId}
```

Khi user chọn một ứng viên, gửi:

```http
POST /api/bookings/{bookingId}/select-technician
```

Body:

```json
{
  "applicationId": "booking-application-id"
}
```

Backend thực hiện trong một transaction:

- Ứng viên được chọn chuyển sang `SELECTED`.
- Booking chuyển sang `CONFIRMED` và gán KTV.
- Các ứng viên `APPLIED` còn lại chuyển sang `NOT_SELECTED`.
- KTV được chọn nhận `TECHNICIAN_SELECTED`.
- Các KTV còn lại nhận `TECHNICIAN_NOT_SELECTED`.

Không xóa bản ghi ứng tuyển; giữ lại để hiển thị lịch sử và đối soát.

## 5. Hủy đơn và hết hạn

User hủy booking:

```http
PATCH /api/bookings/{bookingId}/cancel
```

Khi booking đang mở, các KTV đã ứng tuyển chuyển sang `EXPIRED` và nhận thông báo:

```text
BOOKING_CANCELLED
```

Nếu không có ai được chọn trước deadline, booking chuyển sang `EXPIRED`; user và các KTV đã ứng tuyển nhận `BOOKING_EXPIRED`.

## 6. Đồng bộ thông báo

Mobile nên gọi danh sách thông báo khi mở app, resume app và sau khi đăng nhập:

```http
GET /api/notifications
```

Đánh dấu đã đọc theo API notifications hiện có. Không chỉ phụ thuộc FCM vì thiết bị có thể đang tắt máy, mất mạng hoặc bị hệ điều hành trì hoãn push.

## 7. Quy tắc UI

- Không hiển thị lựa chọn `DIRECT` hoặc `OPEN_MARKETPLACE` cho user.
- Sau khi tạo đơn, hiển thị trạng thái “Đang tìm KTV phù hợp”.
- Khi có ứng viên, hiển thị danh sách KTV và nút chọn KTV.
- Khi đã chọn KTV, khóa thao tác chọn ứng viên khác.
- Khi nhận `TECHNICIAN_NOT_SELECTED`, KTV bỏ đơn khỏi danh sách đang ứng tuyển.
- Khi nhận `BOOKING_CANCELLED` hoặc `BOOKING_EXPIRED`, hiển thị trạng thái tương ứng và không cho ứng tuyển tiếp.

## 8. Lấy catalog và gói giá

Trước khi tạo đơn, mobile lấy dịch vụ và gói giá từ:

```http
GET /api/service-catalog
```

Chỉ gửi các `catalogServiceId` và `priceOptionId` còn hoạt động trong response catalog. Không tự gửi tên dịch vụ hoặc giá do client tự nhập.

