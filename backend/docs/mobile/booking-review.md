# Booking Review

## Chức năng

Màn hình đánh giá kỹ thuật viên sau khi dịch vụ đã hoàn tất. Mobile chỉ hiển thị nút đánh giá khi booking có `status=COMPLETED` và `canReview=true`.

## Auth

Gửi `Authorization: Bearer <accessToken>` của khách hàng. Booking phải thuộc đúng tài khoản đang đăng nhập. Không gửi `technicianId` hay `userId`; backend lấy các giá trị này từ booking.

## Endpoint

`POST /api/bookings/{bookingId}/review`

Request body:

```json
{
  "rating": 5,
  "comment": "Kỹ thuật viên phục vụ rất tốt"
}
```

`rating` là số nguyên từ 1 đến 5. `comment` tùy chọn, tối đa 2000 ký tự; khoảng trắng đầu/cuối được loại bỏ. Không gửi comment nếu không có nhận xét.

## Response thành công

```json
{
  "id": "review-id",
  "bookingId": "booking-id",
  "rating": 5,
  "comment": "Kỹ thuật viên phục vụ rất tốt",
  "createdAt": "2026-09-29T10:00:00.000Z",
  "technician": {
    "technicianId": "technician-profile-id",
    "averageRating": 4.8,
    "reviewCount": 16
  }
}
```

`averageRating` và `reviewCount` là tổng hợp mới của kỹ thuật viên sau khi ghi nhận đánh giá. Thời gian dùng ISO UTC (`Z`).

## Flow Mobile

1. Gọi `GET /api/bookings?status=COMPLETED` hoặc `GET /api/bookings/{id}`.
2. Nếu `canReview=true` và `review=null`, mở form chọn 1–5 sao và nhập nhận xét tùy chọn.
3. Gọi endpoint review với access token.
4. Khi nhận 201, đóng form, cập nhật review và điểm tổng hợp trên màn hình.
5. Nếu người dùng bấm gửi lại, tải lại booking; đánh giá đã tồn tại thì coi như đã hoàn tất.

## Trạng thái UI

- Loading: disable nút gửi và hiển thị spinner.
- Empty: nếu `canReview=false`, không hiển thị form; booking chưa COMPLETED thì thông báo chưa thể đánh giá.
- Success: hiển thị số sao, nhận xét và điểm tổng hợp mới.
- Error: giữ nội dung form để người dùng thử lại, trừ lỗi booking đã được đánh giá.

## Lỗi và cách xử lý

| HTTP | Trường hợp | Mobile xử lý |
|---|---|---|
| 400 | Rating ngoài 1–5; booking chưa COMPLETED; booking đã được đánh giá | Hiển thị lỗi; với đã đánh giá thì tải lại chi tiết và hiển thị review hiện có |
| 401 | Thiếu hoặc access token hết hạn | Refresh token hoặc yêu cầu đăng nhập lại |
| 404 | Booking không tồn tại hoặc không thuộc khách hàng | Không hiển thị form, tải lại danh sách |
| 409 | Xung đột cập nhật đồng thời | Tải lại booking rồi cho phép thử lại |
| 429 | Vượt rate limit | Chờ theo `Retry-After` rồi thử lại |
| 5xx | Lỗi hệ thống | Hiển thị thử lại sau, không xóa dữ liệu form |

## Không được làm

- Không cho đánh giá booking PENDING, CONFIRMED hoặc CANCELLED.
- Không cho chọn hoặc gửi `technicianId`, `customerId`, `userId` từ client.
- Không cho đánh giá lần hai, sửa hoặc xóa review bằng cách gọi API không được tài liệu hóa.
- Không tự cập nhật `averageRating`/`reviewCount`; dùng giá trị backend trả về.
- Không coi việc mở màn hình form là đã giữ chỗ hay đã ghi nhận đánh giá; chỉ thành công sau response API.
