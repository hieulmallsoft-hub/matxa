# Đăng ký kỹ thuật viên

## Quy tắc nghiệp vụ

Tài khoản vẫn là `CUSTOMER` sau khi gửi hồ sơ. Chỉ Admin duyệt thành công mới chuyển role thành `TECHNICIAN` và cho phép xuất hiện trên Marketplace.

## Flow

1. Tạo hồ sơ nháp: `POST /api/technician/application`.
2. Lưu thông tin hồ sơ: `PATCH /api/technician/application`.
3. Lấy presigned URL private để upload CCCD/khuôn mặt: `POST /api/technician/application/document-upload-url`.
4. Upload trực tiếp file lên S3 bằng URL nhận được.
5. Gửi key đã upload trong `PATCH`.
6. **Ký hợp đồng** (xem mục "Ký hợp đồng khi đăng ký" bên dưới).
7. Gửi duyệt kèm chữ ký: `POST /api/technician/application/submit` với body `{ "signatureKey": "…", "device": "iPhone 16 Plus" }`.
8. Theo dõi `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` bằng `GET /api/technician/application`.

## Auth

Các endpoint Mobile yêu cầu `Authorization: Bearer <accessToken>`. Ảnh KYC không được đưa vào API Marketplace; chỉ Admin được cấp presigned URL xem tạm thời.

## Hồ sơ mẫu

```json
{
  "displayName": "Nguyễn Văn An",
  "idCardNumber": "001099012345",
  "gender": "MALE",
  "applicationType": "MASSAGE",
  "city": "Hà Nội",
  "district": "Cầu Giấy",
  "supportedModes": ["HOME", "ONSITE"],
  "facility": "Có phòng riêng",
  "bio": "5 năm kinh nghiệm massage trị liệu",
  "idCardFrontKey": "<storageKey ảnh CCCD mặt trước>",
  "idCardBackKey": "<storageKey ảnh CCCD mặt sau>",
  "faceImageKey": "<storageKey ảnh khuôn mặt>"
}
```

**Bắt buộc trước khi gửi duyệt (4 trường):** `displayName`, `idCardFrontKey`, `idCardBackKey`, `faceImageKey`.
`idCardNumber` (số CCCD) **không bắt buộc**: Admin đọc số trên ảnh CCCD khi duyệt; app có ô nhập thì cứ gửi. Ba trường ảnh là `storageKey` nhận từ `document-upload-url`, phải gửi lại
bằng `PATCH /api/technician/application` sau khi upload xong (chỉ upload lên S3 là chưa đủ).

Thiếu bất kỳ trường nào, `POST /api/technician/application/submit` trả `400` và **nói rõ thiếu gì**:

```json
{
  "statusCode": 400,
  "message": "Ho so con thieu: anh CCCD mat sau, anh khuon mat",
  "missingFields": ["idCardBackKey", "faceImageKey"]
}
```

Hiện popup theo `missingFields` (ví dụ "Hồ sơ còn thiếu: ảnh CCCD mặt sau, ảnh khuôn mặt") và đưa người dùng về đúng
bước còn thiếu, thay vì câu chung "Hồ sơ chưa đủ thông tin".

## KYC

Upload đủ `ID_CARD_FRONT`, `ID_CARD_BACK`, `FACE`. Key phải nằm dưới prefix do backend cấp, không tự tạo URL public. KYC được lưu private trên S3. Nếu bị `REJECTED`, Mobile hiển thị lý do và cho phép sửa/gửi lại.

## Dịch vụ và giá

Mỗi dịch vụ có thể có nhiều `priceOptions` theo category, ví dụ 60/90/120 phút hoặc 2/4/6 tiếng. Mobile không được giả định một service chỉ có một giá và một thời lượng.

## State UI

- `DRAFT`: cho phép chỉnh sửa.
- `SUBMITTED`, `UNDER_REVIEW`: chỉ đọc, hiển thị đang chờ duyệt.
- `APPROVED`: hiển thị đã được duyệt; bắt đầu quản lý dịch vụ/availability.
- `REJECTED`: hiển thị `rejectionReason`, cho phép chỉnh sửa và gửi lại.

Không tự đổi role ở Mobile, không public ảnh CCCD/khuôn mặt, không cho đặt dịch vụ khi hồ sơ chưa `APPROVED`.

## Ký hợp đồng khi đăng ký

Màn "Ký hợp đồng & gửi hồ sơ": KTV đọc hợp đồng, tick đồng ý, **ký tay**, rồi gửi hồ sơ. Backend ghép chữ ký vào
mẫu hợp đồng thành **1 file PDF** (toàn bộ trang mẫu + trang "Xác nhận ký kết" có thông tin KTV, thời điểm ký,
thiết bị/IP và hình chữ ký). Admin xem và tải PDF này khi duyệt hồ sơ. **Duyệt hồ sơ = hợp đồng có hiệu lực.**

| Bước | API | Ghi chú |
|---|---|---|
| 1. Lấy nội dung hợp đồng để hiển thị | `GET /api/technician/application/contract-template` | Trả `downloadUrl` (PDF, hết hạn sau 600 giây) và `fileName`. Mở bằng trình xem PDF trong app. `404` = admin chưa tải mẫu |
| 2. KTV tick đồng ý và ký tay | — | Vẽ chữ ký trên canvas, xuất **PNG nền trắng hoặc trong suốt** (khuyên dùng ~600×300) |
| 3. Lấy link upload chữ ký | `POST /api/technician/application/signature-upload-url` | Body `{ "contentType": "image/png", "size": 25000 }` (tối đa 2MB). Chỉ gọi được khi hồ sơ `DRAFT` hoặc `REJECTED` |
| 4. Upload ảnh chữ ký | `PUT {uploadUrl}` | Header `Content-Type` đúng như bước 3 |
| 5. Gửi hồ sơ kèm chữ ký | `POST /api/technician/application/submit` | Body `{ "signatureKey": "<storageKey bước 3>", "device": "<tên máy>" }` |

| 6. Xem lại hợp đồng đã ký | `GET /api/technician/application/contract` | Trả `contractNumber`, `status`, `signedAt`, **`signedDocumentUrl`** (PDF đã ghép chữ ký, hết hạn 600 giây), `signatureUrl`. `null` nếu chưa ký |

**Màn "hợp đồng đã ký" phải mở `signedDocumentUrl`**, không tự vẽ lại hợp đồng trong app: bản PDF này mới có
chữ ký tay thật và là bản admin lưu. Không hiển thị kiểu "Đại diện Bên A: <tên đánh máy> / Đã ký điện tử <ngày>"
vì đó không phải chữ ký.

Lỗi ở bước 5:

| Lỗi | Ý nghĩa |
|---|---|
| `400 "Chua tai anh chu ky len"` | Chưa PUT ảnh lên `uploadUrl` hoặc upload lỗi → upload lại |
| `400 "Chu ky khong hop le"` | `signatureKey` không phải key backend cấp cho tài khoản này |
| `400 "Chu ky phai la anh PNG hoac JPEG"` | File không phải ảnh |
| `400 "Ho so con thieu: …"` | Thiếu thông tin hoặc ảnh hồ sơ (xem `missingFields`) |

Hồ sơ bị từ chối rồi gửi lại: ký lại (bước 3–5), backend tạo lại PDF với chữ ký mới, **giữ nguyên số hợp đồng**.

`signatureKey` hiện **chưa bắt buộc** để app bản cũ vẫn gửi được hồ sơ; hồ sơ gửi không có chữ ký sẽ hiện
"Chưa ký hợp đồng" ở trang duyệt của Admin.

Bước ký lại sau khi được duyệt (`POST /api/technician/contract/sign`) **không cần dùng nữa**.
