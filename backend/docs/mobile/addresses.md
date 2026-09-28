# Addresses API - Mobile Integration

## 1. Chức năng dùng ở màn nào

Dùng cho màn quản lý địa chỉ, chọn địa chỉ khi đặt HOME service, booking confirmation, booking history và booking detail.

## 2. Authentication

Tất cả API bên dưới cần token backend:

```http
Authorization: Bearer <access_token>
```

Không gửi `userId`; backend lấy current user từ token.

## 3. Danh sách Endpoint

| Method | Endpoint | Chức năng | Auth |
| --- | --- | --- | --- |
| GET | `/api/addresses` | Lấy address còn hiệu lực của current user | Bearer |
| POST | `/api/addresses` | Tạo address | Bearer |
| PATCH | `/api/addresses/:id` | Sửa address hoặc đặt default | Bearer |
| DELETE | `/api/addresses/:id` | Soft-delete address | Bearer |
| POST | `/api/bookings/quote` | Kiểm tra HOME address và xem snapshot dự kiến | Bearer |
| POST | `/api/bookings` | Tạo booking, lưu snapshot address | Bearer |
| GET | `/api/bookings`, `/api/bookings/:id` | History/detail có snapshot address | Bearer |

## 4. Lấy danh sách địa chỉ

```http
GET /api/addresses
```

Không có body hay query. Response là mảng, không gồm address soft-deleted:

```json
[
  {
    "id": "b1d9cc7d-b5f6-44f5-93ef-015430eba575",
    "label": "Nhà",
    "address": "28 Nguyễn Chí Thanh, Đống Đa, Hà Nội",
    "latitude": "21.0245000",
    "longitude": "105.8097000",
    "isDefault": true,
    "createdAt": "2026-09-25T02:00:00.000Z",
    "updatedAt": "2026-09-25T02:00:00.000Z"
  }
]
```

`id` dùng làm `addressId`. `label` là tên hiển thị. `address` là địa chỉ đầy đủ. `latitude`/`longitude` hiện là string do Prisma Decimal. `isDefault=true` là default hiện tại.

## 5. Tạo địa chỉ

```http
POST /api/addresses
Content-Type: application/json
```

```json
{
  "label": "Nhà",
  "address": "28 Nguyễn Chí Thanh, Đống Đa, Hà Nội",
  "latitude": 21.0245,
  "longitude": 105.8097,
  "isDefault": true
}
```

`address`, `latitude`, `longitude` bắt buộc. `label`, `isDefault` tùy chọn. Address đầu tiên tự thành default. `isDefault=true` unset default của address live khác trong transaction.

## 6. Sửa địa chỉ

```http
PATCH /api/addresses/:id
Content-Type: application/json
```

Body là partial của create:

```json
{
  "label": "Nhà mới",
  "address": "100 Trần Duy Hưng, Cầu Giấy, Hà Nội",
  "isDefault": true
}
```

Không gửi `userId`. Nếu `isDefault=true`, backend làm address này thành default và bỏ default của address live khác.

## 7. Xóa địa chỉ

```http
DELETE /api/addresses/:id
```

Thành công trả `204 No Content`. Đây là soft-delete, không xóa booking. Nếu xóa default và còn address khác, address còn lại tạo sớm nhất thành default.

## 8. Đặt địa chỉ mặc định

Không có endpoint riêng. Dùng:

```http
PATCH /api/addresses/:id
```

```json
{ "isDefault": true }
```

Sau response thành công chỉ address này là default. Refetch list hoặc dùng response mới; không coi cache cũ là source of truth.

## 9. Cách dùng khi Booking HOME

1. Gọi `GET /api/addresses`.
2. User chọn address.
3. Mobile chỉ giữ `addressId`.
4. Gửi `addressId` khi quote và create booking.

```json
{
  "technicianId": "<TechnicianProfile UUID>",
  "serviceIds": ["<TechnicianService UUID>"],
  "mode": "HOME",
  "scheduledStart": "2026-10-01T09:00:00+07:00",
  "addressId": "b1d9cc7d-b5f6-44f5-93ef-015430eba575"
}
```

Không gửi address text, lat/lng snapshot hoặc `userId`. Backend tự đọc Address thuộc current user.

## 10. HOME / ONSITE / ONLINE

| Mode | `addressId` |
| --- | --- |
| HOME | Bắt buộc |
| ONSITE | Không gửi |
| ONLINE | Không gửi |

ONSITE/ONLINE gửi `addressId` trả `400`, message `Chi gui addressId khi dat tai nha`.

## 11. Snapshot địa chỉ

Quote HOME trả `addressSnapshot`; booking history/detail trả `address` là snapshot:

```json
{
  "id": "b1d9cc7d-b5f6-44f5-93ef-015430eba575",
  "addressText": "28 Nguyễn Chí Thanh, Đống Đa, Hà Nội",
  "address": "28 Nguyễn Chí Thanh, Đống Đa, Hà Nội",
  "latitude": 21.0245,
  "longitude": 105.8097,
  "label": "Nhà"
}
```

Sửa/xóa Address không đổi booking cũ. Dựng history/detail bằng `booking.address` từ Booking API, không dùng `addressId` gọi Address API. Booking legacy không snapshot chỉ fallback live address nếu còn tồn tại; đây là backward compatibility.

## 12. Error Codes

| HTTP | Message/code thực tế | Mobile nên làm gì |
| --- | --- | --- |
| 401 | `Access token khong hop le hoac da het han` | Refresh token hoặc login lại. |
| 404 | `Dia chi khong ton tai` | Refetch addresses, bỏ selection cũ. |
| 400 | `Dat tai nha can chon dia chi` | Bắt user chọn address HOME. |
| 400 | `Dia chi khong hop le` | Address không thuộc user hoặc đã xóa; refetch và chọn lại. |
| 400 | `Chi gui addressId khi dat tai nha` | Bỏ addressId cho ONSITE/ONLINE. |
| 403 | `PHONE_VERIFICATION_REQUIRED` khi create | Điều hướng xác thực số điện thoại. |

## 13. UI State

- Loading: disable mutation và hiển thị spinner/skeleton.
- Success: refetch/update list sau create, update, delete; đánh dấu item `isDefault=true`.
- Empty: hiển thị CTA thêm address khi response là `[]`.
- Error: giữ form; lỗi address khi booking thì refetch list trước khi retry.

## 14. Ví dụ tích hợp hoàn chỉnh

User vào Đặt lịch → chọn HOME → GET addresses → chọn Nhà → giữ `addressId` → POST quote → hiển thị snapshot/tổng tiền/giờ → POST create với cùng `addressId`. Booking history dùng `booking.address.addressText`, không đọc Address live.

## 15. Những điều Mobile KHÔNG được làm

- Không truyền `userId`.
- Không tin giá/address snapshot do client tự tạo.
- Không dùng live Address để dựng booking history.
- Không gửi `addressId` cho ONLINE/ONSITE.
- Không cache `isDefault` và coi đó là source of truth sau mutation.
