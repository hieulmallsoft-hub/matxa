# Booking Quote API - Mobile Integration

## 1. Chức năng và màn hình sử dụng

Quote được gọi sau khi khách chọn kỹ thuật viên, dịch vụ, hình thức phục vụ và giờ hẹn. Response dùng trực tiếp cho màn xác nhận đặt lịch để hiển thị từng dịch vụ, thời lượng, phụ phí, khuyến mãi và tổng tiền.

Quote **không tạo Booking**, **không giữ khung giờ** và **không tạo/tăng PromotionUsage**. Khi khách nhấn Đặt ngay, Mobile vẫn phải gọi Create Booking; backend sẽ tính và kiểm tra lại mọi dữ liệu.

## 2. Flow Mobile

1. Gọi Technician Detail và lấy `technicianId` cùng `services[].technicianServiceId`.
2. Chọn các dịch vụ, `mode` và gọi Availability với đúng các service đã chọn.
3. Giữ nguyên `startAt` UTC từ Availability khi gọi Quote.
4. Nếu `mode=HOME`, gọi Addresses và để khách chọn một `addressId`.
5. Gọi Quote, render đúng số tiền backend trả về.
6. Khi khách nhấn Đặt ngay, gọi `POST /api/bookings` với các lựa chọn tương ứng và `paymentMethod: "CASH"`.
7. Nếu Create trả lỗi hết chỗ, tải lại Availability rồi yêu cầu khách chọn giờ khác.

## 3. Authentication

Quote yêu cầu Bearer access token:

```http
Authorization: Bearer <accessToken>
```

Quote không yêu cầu xác thực số điện thoại. Create Booking mới yêu cầu tài khoản đã có phone identity; nếu thiếu sẽ trả `403` cùng code `PHONE_VERIFICATION_REQUIRED`.

## 4. Endpoint

| Method | Endpoint | Auth | Chức năng |
|---|---|---|---|
| POST | `/api/bookings/quote` | Bắt buộc | Kiểm tra khả dụng và tính giá trước khi đặt |

## 5. Request body

Contract hiện tại dùng các tên `serviceIds`, `mode`, `scheduledStart`.

```json
{
  "technicianId": "5d361f30-7ab2-4193-b2fb-f17bc60ee5ce",
  "serviceIds": [
    "7280f0f3-a6b1-4c5b-8204-ca56d74a9c31",
    "d218c90a-14a5-4b80-b3c3-698b1b410065"
  ],
  "mode": "HOME",
  "scheduledStart": "2026-10-01T01:00:00.000Z",
  "addressId": "094e5c0b-1f5a-4563-ae2e-ece07b8cc431",
  "promotionCode": "WELCOME"
}
```

| Field | Bắt buộc | Mô tả |
|---|---:|---|
| `technicianId` | Có | `TechnicianProfile.id`, không phải `User.id`. |
| `serviceIds` | Có | Mảng 1–10 `TechnicianService.id` từ màn Technician Detail. Tên field cũ là `serviceIds`, nhưng giá trị phải là ID dịch vụ của KTV; không phải `categoryId` hay master service ID. |
| `mode` | Có | `HOME`, `ONSITE` hoặc `ONLINE`. |
| `scheduledStart` | Có | ISO-8601 có `Z` hoặc timezone offset, phải ở tương lai. Nên giữ nguyên `startAt` từ Availability. |
| `addressId` | HOME: Có | ID Address của tài khoản hiện tại. Không gửi field này với `ONSITE`/`ONLINE`. |
| `promotionCode` | Không | Chuỗi tối đa 50 ký tự. Backend tự chuẩn hóa, kiểm tra và tính giảm giá. |

`2026-10-01T01:00:00.000Z` tương ứng 08:00 tại `Asia/Ho_Chi_Minh`.

## 6. HOME / ONSITE / ONLINE

| Mode | `addressId` | Phí dịch vụ |
|---|---|---:|
| `HOME` | Bắt buộc, thuộc user hiện tại | `HOME_SERVICE_FEE` từ cấu hình backend; mặc định 100000 VND |
| `ONSITE` | Không được gửi | 0 |
| `ONLINE` | Không được gửi | 0 |

Backend lấy nội dung, tọa độ địa chỉ từ database. Mobile không gửi address text, latitude hay longitude trong Quote.

## 7. Response

```json
{
  "technicianId": "5d361f30-7ab2-4193-b2fb-f17bc60ee5ce",
  "technicianServiceIds": [
    "7280f0f3-a6b1-4c5b-8204-ca56d74a9c31",
    "d218c90a-14a5-4b80-b3c3-698b1b410065"
  ],
  "services": [
    {
      "id": "7280f0f3-a6b1-4c5b-8204-ca56d74a9c31",
      "serviceId": "7280f0f3-a6b1-4c5b-8204-ca56d74a9c31",
      "technicianServiceId": "7280f0f3-a6b1-4c5b-8204-ca56d74a9c31",
      "name": "Massage cổ vai gáy",
      "durationMinutes": 60,
      "price": 500000
    }
  ],
  "mode": "HOME",
  "serviceMode": "HOME",
  "scheduledStart": "2026-10-01T01:00:00.000Z",
  "scheduledEnd": "2026-10-01T02:00:00.000Z",
  "startAt": "2026-10-01T01:00:00.000Z",
  "endAt": "2026-10-01T02:00:00.000Z",
  "durationMinutes": 60,
  "totalDuration": 60,
  "totalDurationMinutes": 60,
  "addressSnapshot": {
    "id": "094e5c0b-1f5a-4563-ae2e-ece07b8cc431",
    "addressText": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "address": "12 Nguyễn Huệ, Quận 1, TP.HCM",
    "latitude": 10.7731,
    "longitude": 106.7043,
    "label": "Nhà"
  },
  "subtotal": 500000,
  "serviceFee": 100000,
  "homeServiceFee": 100000,
  "promotionId": "98b1afab-75eb-4e1d-92d4-66a1a01a7a9b",
  "promotionCode": "WELCOME",
  "discountAmount": 50000,
  "discount": 50000,
  "promotion": {
    "id": "98b1afab-75eb-4e1d-92d4-66a1a01a7a9b",
    "code": "WELCOME",
    "discount": 50000
  },
  "totalAmount": 550000,
  "total": 550000
}
```

`totalDurationMinutes`, `homeServiceFee`, `discount`, `total` là các field nên dùng cho UI. Các alias cũ (`durationMinutes`, `serviceFee`, `discountAmount`, `totalAmount`) vẫn được giữ để tương thích.

Mọi số tiền là số nguyên VND; ví dụ `500000` hiển thị là `500.000đ`. Mobile chỉ format tiền, không tự cộng/trừ lại.

Khi không có promotion, `promotionId`, `promotionCode`, `promotion` là `null` và `discount` là `0`. Với ONSITE/ONLINE, `addressSnapshot` là `null` và `homeServiceFee` là `0`.

## 8. Validation backend

Backend kiểm tra profile KTV active, verified, user KTV `ACTIVE`; toàn bộ dịch vụ phải thuộc KTV, active, category active và hỗ trợ mode đã chọn. Backend lấy giá/thời lượng từ database, tính `endAt`, yêu cầu cả khoảng nằm trong một working interval, và kiểm tra overlap với Booking `PENDING`/`CONFIRMED`.

Promotion phải active, còn hiệu lực, đạt min order, còn usage toàn hệ thống và usage của user. Hỗ trợ `FIXED` và `PERCENT`; `maxDiscount` được áp dụng khi có. Tổng tiền luôn bằng `max(0, subtotal + homeServiceFee - discount)`.

## 9. Error và xử lý Mobile

Project trả error theo NestJS, thường có dạng:

```json
{ "statusCode": 400, "message": "Khung gio da co nguoi dat", "error": "Bad Request" }
```

| HTTP | Message/code | Mobile xử lý |
|---:|---|---|
| 400 | `Khung gio da co nguoi dat` hoặc `Ky thuat vien khong ranh trong khung gio nay` | Báo giờ vừa hết, refresh Availability. |
| 400 | `Thoi gian dat lich phai o tuong lai` | Chọn lại giờ. |
| 400 | `Dat tai nha can chon dia chi` / `Dia chi khong hop le` | Mở hoặc reload Addresses. |
| 400 | `Chi gui addressId khi dat tai nha` | Bỏ `addressId` với ONSITE/ONLINE. |
| 400 | `Ma khuyen mai khong hop le hoac da het han`, `Don hang chua dat gia tri toi thieu`, `Ma khuyen mai da het luot su dung` | Bỏ voucher khỏi UI và cho nhập lại. |
| 400 | `Co dich vu khong hop le...` / `Dich vu khong ho tro hinh thuc da chon` | Tải lại Technician Detail, chọn lại dịch vụ/mode. |
| 401 | Unauthorized | Điều hướng đăng nhập/làm mới token. |
| 403 | `PHONE_VERIFICATION_REQUIRED` | Chỉ xảy ra lúc Create Booking: điều hướng xác thực số điện thoại. |
| 409 | Dữ liệu booking thay đổi | Tải lại quote/Availability trước khi thử lại. |

## 10. UI states

- Trong lúc gọi Quote, disable nút Đặt ngay và hiện loading.
- Chỉ render giá từ Quote thành công; Quote lỗi thì không giữ giá cũ để đặt.
- Promotion lỗi hiển thị tại ô voucher và xóa promotion đang áp dụng.
- Slot/address lỗi hiển thị hành động chọn lại giờ hoặc địa chỉ.
- Lỗi khác hiển thị thông điệp server hoặc trạng thái thử lại.

## 11. Những điều Mobile không được làm

- Không gửi hoặc tự tin `price`, `duration`, `subtotal`, `discount`, `total` từ client.
- Không dùng `User.id` thay cho `TechnicianProfile.id`.
- Không dùng category/master-service ID thay cho `TechnicianService.id` trong `serviceIds`.
- Không gửi `addressId` cho ONSITE/ONLINE.
- Không coi Quote thành công là đã giữ slot.
- Không tái sử dụng giá quote cũ để Create Booking; backend sẽ tính lại theo dữ liệu hiện tại.
- Không tự áp dụng `HOME_SERVICE_FEE` hoặc discount vào source of truth của đơn.
