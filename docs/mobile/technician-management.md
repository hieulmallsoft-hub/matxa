# Mobile integration: Đăng ký và tự quản lý KTV

Base URL: `<apiOrigin>/api`  
Các endpoint trong tài liệu này cần header:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

`<accessToken>` luôn là token của tài khoản đang đăng nhập. Mobile không gửi `userId`, `role`, `isVerified`, `status`, `reviewedBy` hoặc các field duyệt hồ sơ.

## 1. Hai giai đoạn

| Giai đoạn | Role tài khoản | Nhóm API dùng |
|---|---|---|
| Đăng ký KTV | `CUSTOMER` | `/technician/application/*` |
| Đã được duyệt | `TECHNICIAN` | `/technician/profile`, `/technician/services`, `/technician/availability` |

Gửi hồ sơ chỉ chuyển status sang `SUBMITTED`; không tự đổi role. Chỉ Admin approve mới tạo/cập nhật `TechnicianProfile`, đặt `isVerified=true` và đổi role thành `TECHNICIAN`.

## 2. Application status

| Status | Mobile hiển thị | Người dùng được làm gì |
|---|---|---|
| `DRAFT` | Hồ sơ nháp | Sửa, upload/xóa gallery, upload KYC, submit |
| `SUBMITTED` | Đã gửi, chờ xử lý | Chỉ đọc, chờ Admin review |
| `UNDER_REVIEW` | Admin đang xét duyệt | Chỉ đọc |
| `REJECTED` | Cần bổ sung | Hiển thị `rejectionReason`, cho sửa và submit lại |
| `APPROVED` | Đã là KTV | Dùng API Technician Management |

## 3. Tạo/lấy/cập nhật hồ sơ đăng ký

### Tạo draft

```http
POST /technician/application
```

Body có thể rỗng để tạo draft trước. Nếu draft đã tồn tại, backend trả lại draft cũ, không tạo bản ghi trùng.

### Lấy hồ sơ hiện tại

```http
GET /technician/application
```

Response mẫu:

```json
{
  "id": "<applicationId>",
  "status": "DRAFT",
  "displayName": "Nguyen Van An",
  "gender": "MALE",
  "city": "Ha Noi",
  "district": "Cau Giay",
  "facility": "An Wellness",
  "address": "Cau Giay, Ha Noi",
  "supportedModes": ["HOME", "ONSITE"],
  "bio": "Ky thuat vien massage",
  "idCardFrontKey": null,
  "idCardBackKey": null,
  "faceImageKey": null,
  "rejectionReason": null,
  "gallery": [],
  "kyc": { "status": "NOT_STARTED", "rejectionReason": null }
}
```

### Cập nhật draft

```http
PATCH /technician/application
```

```json
{
  "displayName": "Nguyen Van An",
  "gender": "MALE",
  "applicationType": "INDIVIDUAL_PART_TIME",
  "city": "Ha Noi",
  "district": "Cau Giay",
  "supportedModes": ["HOME", "ONSITE"],
  "facility": "An Wellness",
  "address": "Cau Giay, Ha Noi",
  "bio": "5 nam kinh nghiem massage tri lieu"
}
```

Field hợp lệ:

| Field | Rule |
|---|---|
| `displayName` | Tối đa 100 ký tự, không rỗng nếu gửi |
| `gender` | `MALE`, `FEMALE`, `OTHER` |
| `applicationType` | Tối đa 50 ký tự |
| `city`, `district` | Tối đa 100 ký tự |
| `supportedModes` | Mảng `HOME`, `ONSITE`, `ONLINE` |
| `facility` | Tối đa 150 ký tự |
| `address` | Tối đa 300 ký tự |
| `bio` | Tối đa 2.000 ký tự |

Nếu `supportedModes` có `ONSITE`, bắt buộc có cả `facility` và `address`; sai rule trả `400`.

`PATCH` bị từ chối với `409` khi hồ sơ là `SUBMITTED`, `UNDER_REVIEW` hoặc `APPROVED`.

## 4. Upload CCCD và ảnh khuôn mặt

### Bước 1: lấy URL upload

```http
POST /technician/application/document-upload-url
```

```json
{
  "documentType": "ID_CARD_FRONT",
  "contentType": "image/jpeg",
  "size": 250000
}
```

`documentType`:

```text
ID_CARD_FRONT
ID_CARD_BACK
FACE
```

`contentType` chỉ nhận `image/jpeg`, `image/png`, `image/webp`. Kích thước tối đa 10 MB.

Response:

```json
{
  "uploadUrl": "<presignedPutUrl>",
  "mediaKey": "technician-applications/<currentUserId>/id_card_front/<file>.jpg",
  "expiresIn": 300
}
```

### Bước 2: upload trực tiếp S3

Mobile `PUT` bytes ảnh vào `uploadUrl`, đặt `Content-Type` đúng bằng `contentType` đã dùng để lấy URL. Không gửi ảnh base64 về backend.

### Bước 3: lưu key vào application

Sau khi PUT thành công, gọi:

```http
PATCH /technician/application
```

```json
{
  "idCardFrontKey": "<mediaKeyFront>",
  "idCardBackKey": "<mediaKeyBack>",
  "faceImageKey": "<mediaKeyFace>"
}
```

Không tự tạo `mediaKey`; key phải là key backend đã trả về cho tài khoản hiện tại.

## 5. Gallery dịch vụ

Tối đa 6 ảnh và chỉ sửa được khi application là `DRAFT` hoặc `REJECTED`.

### Lấy URL upload gallery

```http
POST /technician/application/gallery-upload-url
```

```json
{ "contentType": "image/jpeg", "size": 300000 }
```

PUT ảnh vào `uploadUrl`, sau đó lưu key:

```http
POST /technician/application/gallery
```

```json
{
  "storageKey": "<galleryMediaKey>",
  "sortOrder": 0
}
```

Xóa ảnh:

```http
DELETE /technician/application/gallery/<galleryImageId>
```

## 6. Submit và resubmit

```http
POST /technician/application/submit
```

Điều kiện hiện tại để submit:

- Có `displayName`.
- Có CCCD mặt trước.
- Có CCCD mặt sau.
- Có ảnh khuôn mặt.
- Nếu chọn `ONSITE`, có `facility` và `address`.

Response thành công trả application có:

```json
{ "status": "SUBMITTED" }
```

Khi `REJECTED`, Mobile lấy `rejectionReason`, cho người dùng `PATCH` các field cần sửa rồi gọi lại submit. Không tạo application mới.

## 7. Sau khi Admin duyệt: quản lý hồ sơ KTV

Các API dưới đây chỉ dùng sau khi `GET /technician/application` trả `APPROVED`.

### Cập nhật profile đã duyệt

```http
PATCH /technician/profile
```

```json
{
  "bio": "Massage tri lieu tai nha",
  "gender": "MALE",
  "tags": ["massage", "tri-lieu"],
  "serviceModes": ["HOME", "ONSITE"],
  "city": "Ha Noi",
  "address": "Cau Giay, Ha Noi",
  "isAvailable": true
}
```

KTV không được gửi `isVerified` hoặc `isActive`; đây là field Admin quản lý.

## 8. Quản lý service

### Tạo service

```http
POST /technician/services
```

```json
{
  "categoryId": "<categoryId>",
  "name": "Massage tri lieu",
  "description": "Goi massage 60 phut",
  "durationMinutes": 60,
  "price": 300000,
  "modes": ["HOME"]
}
```

`modes` của service phải là subset của `serviceModes` trên profile. Ví dụ profile chỉ có `HOME`, service gửi `ONSITE` sẽ bị `400`.

Sửa service:

```http
PATCH /technician/services/<technicianServiceId>
```

## 9. Price options

```text
GET    /technician/services/<technicianServiceId>/price-options
POST   /technician/services/<technicianServiceId>/price-options
PATCH  /technician/services/<technicianServiceId>/price-options/<priceOptionId>
DELETE /technician/services/<technicianServiceId>/price-options/<priceOptionId>
```

Tạo option:

```json
{
  "code": "90_MINUTES",
  "durationMinutes": 90,
  "price": 450000,
  "sortOrder": 2,
  "isActive": true
}
```

Option inactive hoặc đã xóa sẽ không dùng được trong quote/booking mới.

## 10. Lịch làm việc

Tạo khung giờ:

```http
POST /technician/availability
```

```json
{
  "startAt": "2026-10-03T02:00:00.000Z",
  "endAt": "2026-10-03T05:00:00.000Z"
}
```

Xóa:

```http
DELETE /technician/availability/<availabilityId>
```

Thời gian phải là ISO-8601 có timezone, dùng UTC `Z` để tránh lệch múi giờ.

## 11. Error handling

| HTTP | Ý nghĩa | Mobile xử lý |
|---|---|---|
| `400` | Dữ liệu sai, thiếu KYC, sai mode hoặc sai ONSITE | Hiển thị `message` gần field liên quan |
| `401` | Token hết hạn/thiếu token | Refresh token hoặc yêu cầu đăng nhập lại |
| `403` | Chưa là TECHNICIAN hoặc không có quyền | Hiển thị trạng thái chờ duyệt, không mở màn quản lý KTV |
| `404` | Service/gallery/availability không tồn tại hoặc không thuộc owner | Refresh dữ liệu, không retry mù quáng |
| `409` | Hồ sơ đang chờ duyệt hoặc đã duyệt | Chuyển UI sang read-only và load lại application |

## 12. Mobile không được làm

- Không tự set `role=TECHNICIAN`.
- Không tự set application `status`, `reviewedBy`, `reviewedAt`, `approvedAt`, `isVerified` hoặc `isActive`.
- Không gửi giá/thời lượng client tính cho booking; chọn `priceOptionId` và để backend tính.
- Không public hoặc cache URL/keys CCCD, ảnh khuôn mặt.
- Không dùng key S3 của tài khoản khác.
