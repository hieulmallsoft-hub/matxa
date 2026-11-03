# Mobile: tìm KTV và đặt lịch

User chọn thông tin dịch vụ, xem danh sách KTV phù hợp, chọn KTV ban đầu rồi đặt lịch. Mobile gửi `technicianId` nhưng không gửi `assignmentMode`. Backend lưu lựa chọn ban đầu ở `requestedTechnicianId`, mở đơn cho các KTV phù hợp ứng tuyển đồng thời; khách chốt một ứng viên sau đó.

Chi tiết phân loại card “Khách đặt bạn” và “Yêu cầu mới”: [Hướng dẫn mobile](booking-request-recipient.md).

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

Backend tạo booking `OPEN`, `assignmentMode = OPEN_MARKETPLACE`, `technicianId = null` và lưu KTV chọn ban đầu ở `requestedTechnicianId`. Các KTV phù hợp cùng nhận cơ hội ứng tuyển qua `GET /api/technician/jobs`. Chưa gán đơn cuối cùng ở bước này.

Không gửi `assignmentMode` hoặc `serviceIds`.

## 3. Thông báo cho KTV

Khi tạo booking mở thành công, backend lưu `OPEN_BOOKING_REQUESTED` cho KTV khách chọn và `OPEN_BOOKING_AVAILABLE` cho các KTV đủ điều kiện khác đồng thời và gửi push FCM nếu có device token. KTV khách chọn ban đầu thấy `requestType = CUSTOMER_REQUEST`, nhãn “Khách đặt bạn”; KTV phù hợp khác thấy `requestType = MARKETPLACE`, nhãn “Yêu cầu mới”. Thông báo trong hệ thống vẫn được lưu khi KTV không mở app, mất mạng hoặc tắt máy.

Khi app mở lại, mobile KTV đồng bộ:

```http
GET /api/notifications
```

KTV xem đơn:

```http
GET /api/technician/jobs
```

KTV ứng tuyển (không có body):

```http
POST /api/technician/jobs/{bookingId}/apply
```

Customer lấy `GET /api/bookings/{bookingId}`, đọc `applications` (danh sách “KTV đang muốn phục vụ bạn”) rồi chốt bằng `POST /api/bookings/{bookingId}/select-technician` với body `{"applicationId":"ID ứng tuyển"}`. Backend gán `technicianId` cuối cùng, chuyển booking thành `CONFIRMED`; KTV thắng có `isSelected = true`, các ứng viên còn lại thành `NOT_SELECTED`.

Mỗi phần tử `applications`:

```json
{
  "applicationId": "uuid",
  "technicianId": "technician-profile-id",
  "displayName": "Nguyễn Thị Mai",
  "avatarUrl": "https://...",
  "averageRating": 4.8,
  "reviewCount": 15,
  "status": "APPLIED",
  "isSelected": false,
  "isApplicant": true,
  "appliedAt": "2026-11-03T08:00:00.000Z"
}
```

Chỉ hiện các phần tử `isApplicant = true` trong màn chờ (`WITHDRAWN`, `DECLINED`, `EXPIRED` là KTV đã rút hoặc từ chối). Khi có KTV ứng tuyển, khách nhận thông báo `TECHNICIAN_APPLIED` (trong app + push); khi nhận, gọi lại `GET /api/bookings/{bookingId}` để cập nhật danh sách. Trong lúc đang mở màn chờ, nên tải lại định kỳ (vd 10 giây) vì push có thể đến chậm.

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

## 7. API ứng tuyển và chốt KTV

Các API dùng trong giai đoạn chờ:

```text
POST /api/bookings/{bookingId}/select-technician
POST /api/technician/jobs/{bookingId}/apply
POST /api/technician/jobs/{bookingId}/withdraw
```

`POST /api/technician/jobs/{bookingId}/accept` dành cho đơn DIRECT cũ. Luồng OPEN dùng `apply` rồi customer chốt bằng `select-technician`.

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

Booking thành công trả về `201`, `bookingStatus: "OPEN"`, `bookingId`, `requestedTechnicianId`. Dùng cả hai token KTV để kiểm tra cùng booking xuất hiện, với hai `requestType` khác nhau.

### Bước 4: KTV xem và nhận đơn

```http
GET /api/technician/jobs
POST /api/technician/jobs/{bookingId}/apply
```

Matching và chốt ứng viên dùng token customer; availability/jobs/apply dùng token KTV. Quy trình test đầy đủ có trong [hướng dẫn phân loại card](booking-request-recipient.md).
