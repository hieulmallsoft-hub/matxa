# Booking History API - Mobile Integration

## 1. Màn hình sử dụng

Các màn Lịch sử hoạt động, Booking Detail, chờ KTV xác nhận, đã xác nhận, hoàn thành và đã hủy dùng chung API booking.

## 2. Authentication

Hai endpoint đều yêu cầu `Authorization: Bearer <access_token>`. Backend lấy user từ token; Mobile không truyền `userId` hay `customerId`.

## 3. Endpoints

```http
GET /api/bookings?status=PENDING&page=1&limit=20
GET /api/bookings/:id
```

`status` có thể là `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`. Kết quả mới nhất trước (`scheduledStart DESC`).

## 4. Booking status

| Backend | Hiển thị gợi ý |
| --- | --- |
| `PENDING` | Đang chờ kỹ thuật viên xác nhận |
| `CONFIRMED` | Đã xác nhận / sắp diễn ra |
| `COMPLETED` | Hoàn thành |
| `CANCELLED` | Đã hủy |

Không tạo status riêng như `WAITING_TECHNICIAN`. Backend hiện chưa có `expiresAt` hoặc tự động hủy pending, vì vậy Mobile không tự hardcode countdown hay tự đổi status.

## 5. List response

```json
{
  "items": [{
    "id": "booking-uuid",
    "status": "PENDING",
    "technician": { "technicianId": "profile-uuid", "displayName": "Kim Nguyễn", "avatarUrl": "https://..." },
    "service": { "name": "Massage chân", "price": 500000, "durationMinutes": 60 },
    "items": [{ "technicianServiceId": "service-uuid", "name": "Massage chân", "price": 500000, "durationMinutes": 60 }],
    "mode": "HOME",
    "startAt": "2026-10-01T01:00:00.000Z",
    "endAt": "2026-10-01T02:00:00.000Z",
    "total": 600000,
    "paymentMethod": "CASH",
    "canCancel": true,
    "canReview": false,
    "createdAt": "2026-09-29T08:00:00.000Z"
  }],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

## 6. Detail response và snapshot

`GET /api/bookings/:id` trả thêm `subtotal`, `serviceFee`, `homeServiceFee`, `discount`, `totalAmount`, `paymentStatus`, `promotion`, `note`, `cancelledAt`, `cancellationReason`, `review`, `canCancel` và `canReview` cùng các field của card.

`items` luôn dùng `serviceName`/`unitPrice`/`durationMinutes` snapshot trong `BookingItem`; không lookup giá dịch vụ hiện tại. Với `HOME`, `address` là `addressSnapshot` tại thời điểm đặt, gồm `label`, `addressText`, `latitude`, `longitude`. Sửa hoặc xóa Address sau đó không đổi lịch sử. Với `ONSITE`, dùng thông tin location hiện có của booking nếu có; với `ONLINE`, `address` là `null`.

## 7. Quyền và trạng thái CTA

Customer chỉ xem được booking của mình; user khác nhận lỗi không có quyền. `canCancel=true` chỉ khi chính customer và status là `PENDING` hoặc `CONFIRMED`. `canReview=true` chỉ khi chính customer, status `COMPLETED` và booking chưa có review. `CANCELLED` không thể hủy hoặc review.

## 8. Loading, empty và lỗi

- Loading: hiển thị skeleton; khi phân trang, giữ trang cũ trong lúc tải trang mới.
- Empty: `items=[]` hiển thị “Chưa có hoạt động nào”.
- `401`: refresh token hoặc đưa user về Login.
- `403/404`: không hiển thị detail, quay về danh sách và báo booking không tồn tại/không có quyền.
- Lỗi mạng/5xx: cho phép retry GET.

Mobile không được truyền userId, tự tính `canReview`, dùng service/address hiện tại thay snapshot, tự đổi status, hoặc coi countdown phía client là nguồn sự thật.
