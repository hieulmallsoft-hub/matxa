# Create Booking API - Mobile Integration

## 1. Chức năng và màn hình sử dụng

Gọi sau khi người dùng đã xem Quote và bấm **Đặt ngay**. Booking mới luôn có trạng thái `PENDING` (đang chờ kỹ thuật viên xác nhận).

## 2. Điều kiện trước khi gọi

Người dùng phải đăng nhập và đã xác thực số điện thoại. Mobile cần có `technicianId` (ID của `TechnicianProfile`), các `serviceIds` (ID `TechnicianService`), mode và thời điểm từ Availability. Với `HOME`, bắt buộc chọn một address của chính người dùng.

## 3. Endpoint

| Method | Endpoint        | Auth                    |
| ------ | --------------- | ----------------------- |
| `POST` | `/api/bookings` | `Bearer <access_token>` |

## 4. Request body

Contract hiện tại dùng `serviceIds` và `scheduledStart`:

```json
{
  "technicianId": "11111111-1111-4111-8111-111111111111",
  "serviceIds": ["22222222-2222-4222-8222-222222222222"],
  "mode": "HOME",
  "scheduledStart": "2026-10-01T01:00:00.000Z",
  "addressId": "33333333-3333-4333-8333-333333333333",
  "promotionCode": "WELCOME",
  "paymentMethod": "CASH",
  "note": "Vui lòng gọi trước khi đến"
}
```

- `technicianId` là `TechnicianProfile.id`, không phải `User.id`.
- `serviceIds` là mảng `TechnicianService.id` của đúng kỹ thuật viên.
- `scheduledStart` là ISO UTC lấy trực tiếp từ Availability; không tự đổi timezone sai.
- `addressId` chỉ gửi với `HOME`. Với `ONSITE` và `ONLINE`, không gửi address.
- Chỉ hỗ trợ `CASH`.

Không gửi giá, duration, endAt, tổng tiền, discount, booking status, service snapshot hoặc address snapshot. Backend tính và snapshot lại toàn bộ từ database.

## 5. Flow Mobile

Technician Detail → chọn service → Availability → chọn slot → chọn address nếu HOME → `POST /api/bookings/quote` → hiển thị quote → bấm Đặt ngay → `POST /api/bookings` → Booking Success/Detail.

Quote không giữ slot. Create Booking luôn kiểm tra lại kỹ thuật viên, dịch vụ, giá, lịch, voucher và address.

## 6. Response

```json
{
  "id": "booking-uuid",
  "status": "PENDING",
  "technician": {
    "technicianId": "11111111-1111-4111-8111-111111111111",
    "displayName": "Kim Nguyễn",
    "avatarUrl": "https://..."
  },
  "items": [
    {
      "technicianServiceId": "22222222-2222-4222-8222-222222222222",
      "serviceId": "22222222-2222-4222-8222-222222222222",
      "name": "Massage chân",
      "price": 500000,
      "durationMinutes": 60
    }
  ],
  "mode": "HOME",
  "startAt": "2026-10-01T01:00:00.000Z",
  "endAt": "2026-10-01T02:00:00.000Z",
  "subtotal": 500000,
  "homeServiceFee": 100000,
  "discount": 50000,
  "total": 550000,
  "paymentMethod": "CASH",
  "paymentStatus": "UNPAID",
  "address": {
    "id": "33333333-3333-4333-8333-333333333333",
    "label": "Nhà",
    "addressText": "12 Nguyễn Huệ, Quận 1",
    "latitude": 10.77,
    "longitude": 106.7
  }
}
```

`address` là snapshot lịch sử; sửa địa chỉ sau đó không đổi booking cũ. Với `ONSITE`/`ONLINE`, `address` là `null`.

## 7. Error handling

| HTTP / code                          | Mobile xử lý                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `401`                                | Đưa về đăng nhập hoặc refresh token theo luồng app.                                                          |
| `403`, `PHONE_VERIFICATION_REQUIRED` | Điều hướng xác thực số điện thoại, sau đó tạo lại từ Quote.                                                  |
| `400`                                | Hiển thị message: service/mode/address/voucher/thời gian không hợp lệ. Với voucher, bỏ voucher và quote lại. |
| `409`, `SLOT_UNAVAILABLE`            | Đóng loading, báo slot vừa được đặt, gọi lại Availability, cho chọn giờ mới và Quote lại.                    |
| `409` khác                           | Tải lại dữ liệu booking/quote trước khi thử lại.                                                             |

## 8. UI states

- **Idle:** nút Đặt ngay khả dụng khi quote hợp lệ.
- **Submitting:** disable nút để tránh double tap và hiển thị loading.
- **Success:** đi tới Booking Success/Detail với `id` response.
- **Error:** bật lại nút; không retry mù quáng sau timeout khi chưa kiểm tra kết quả booking.

## 9. Những điều Mobile không được làm

- Không coi Quote là booking hoặc tự đặt status `CONFIRMED`.
- Không gửi `User.id` thay `technicianId`.
- Không gửi dữ liệu giá/snapshot do client tính.
- Không hiển thị phương thức thanh toán khác `CASH`.
- Không gửi nhiều request Create Booking cùng lúc.

Hiện API chưa nhận idempotency key. Backend có exclusion constraint để ngăn hai booking overlap cùng KTV, nhưng Mobile vẫn phải khóa nút trong lúc gửi để tránh retry tạo hai booking khác slot.
