# Việc mobile cần làm (cập nhật 05/11/2026)

Backend đã xong và đang chạy trên server. Swagger: http://149.28.156.66:5600/api/docs

## A. Đăng ký KTV (app KTV)

Luồng màn hình: **Chụp CCCD + quét QR → Chụp khuôn mặt → Xem hợp đồng đã điền sẵn → Tick + ký tay → Gửi hồ sơ**

> Hiện trạng trên server: app đã upload ảnh CCCD nhưng **chưa gửi chuỗi QR**, và màn ký vẫn là hợp đồng app tự vẽ.
> Vì vậy hợp đồng chưa tự điền theo CCCD. Hai việc A1 và A3 bên dưới là việc chính cần làm.

### A1. Quét QR trên CCCD và gửi lên (bắt buộc làm)

Ở bước chụp CCCD mặt trước, dùng thư viện quét QR trên máy để đọc mã QR in trên thẻ (thẻ gắn chip và thẻ căn cước
mới đều có). Gửi **nguyên chuỗi** đọc được, không tự tách, không sửa:

```http
PATCH /api/technician/application
Authorization: Bearer <token>

{ "idCardQr": "001099012345|123456789|Nguyễn Văn An|01011999|Nam|Cầu Giấy, Hà Nội|15082021" }
```

- Tên trường phải đúng là **`idCardQr`**. Server **bỏ qua trường lạ mà không báo lỗi**, gửi sai tên sẽ tưởng là đã thành công.
- **Kiểm tra đã gửi được:** response có `idCardInfo.fullName` đúng tên trên thẻ.
- Hiện lại họ tên, ngày sinh, số CCCD, địa chỉ (lấy từ `idCardInfo`) cho KTV xem trước khi bấm Tiếp tục.
- `400 "Ma QR CCCD khong hop le, vui long quet lai"` → hiện "Không đọc được mã QR, vui lòng quét lại".
- Thẻ cũ không có QR thì vẫn cho đi tiếp (không bắt buộc để gửi hồ sơ).

Response (rút gọn):

```json
{
  "idCardNumber": "001099012345",
  "idCardInfo": {
    "fullName": "Nguyễn Văn An", "dateOfBirth": "1999-01-01", "gender": "MALE",
    "permanentAddress": "Cầu Giấy, Hà Nội", "issueDate": "2021-08-15",
    "issuePlace": "Cục Cảnh sát quản lý hành chính về trật tự xã hội"
  }
}
```

### A2. Bỏ bắt buộc số CCCD, báo rõ thiếu gì

- Không bắt buộc ô nhập số CCCD nữa. Để gửi hồ sơ chỉ cần **tên + 3 ảnh** (CCCD trước, CCCD sau, khuôn mặt).
- Khi `POST /api/technician/application/submit` trả `400`, đọc `missingFields` (ví dụ `["idCardBackKey", "faceImageKey"]`)
  để hiện "Hồ sơ còn thiếu: ảnh CCCD mặt sau, ảnh khuôn mặt" và đưa về đúng bước.

### A3. Màn "Ký hợp đồng & gửi hồ sơ": mở PDF từ server (bắt buộc làm)

**Bỏ hợp đồng app đang tự vẽ** (đoạn "Bên A: LÊ HIẾU…"). Thay bằng:

```http
GET /api/technician/application/contract-preview
→ { "downloadUrl": "https://…", "expiresIn": 600, "fileName": "hop-dong-xem-truoc.pdf", "idCardScanned": true }
```

- Mở `downloadUrl` bằng trình xem PDF trong app. Đây là hợp đồng **đã điền sẵn** thông tin Bên A theo CCCD;
  trang cuối ghi "Bản xem trước · chưa ký".
- **Gọi lại mỗi lần mở màn**: link hết hạn sau 600 giây, không lưu link.
- `idCardScanned: false` → chưa quét QR (A1), nên đưa KTV quay lại bước quét CCCD.
- API `contract-template` (mẫu trống) **không dùng nữa**.

### A4. Ký tay và gửi hồ sơ

| Bước | API | Ghi chú |
|---|---|---|
| 1. KTV tick đồng ý, ký trên canvas | — | Xuất PNG nền trắng/trong suốt, khoảng 600×300 |
| 2. Lấy link upload chữ ký | `POST /api/technician/application/signature-upload-url` | Body `{ "contentType": "image/png", "size": <bytes> }`, tối đa 2MB |
| 3. Upload ảnh | `PUT {uploadUrl}` | Header `Content-Type: image/png` |
| 4. Gửi hồ sơ | `POST /api/technician/application/submit` | Body `{ "signatureKey": "<storageKey bước 2>", "device": "<tên máy>" }` |

Lỗi khi gửi:

| Lỗi | Xử lý |
|---|---|
| `400 "Chua tai anh chu ky len"` | Upload lại chữ ký (bước 2–3) |
| `400 "Chu ky khong hop le"` | `signatureKey` không phải key server cấp cho tài khoản này |
| `400 "Chu ky phai la anh PNG hoac JPEG"` | File chữ ký không phải ảnh |
| `400 "Ho so con thieu: …"` | Xem `missingFields` (A2) |

Bị từ chối rồi gửi lại: ký lại bước 2–4, số hợp đồng giữ nguyên.

### A5. Xem lại hợp đồng đã ký

```http
GET /api/technician/application/contract
→ { "contractNumber": "HD-2026-…", "status": "PENDING_REVIEW", "signedAt": "…", "signedDocumentUrl": "https://…", "signatureUrl": "https://…" }
```

Mở `signedDocumentUrl` (PDF có chữ ký tay thật). **Không tự vẽ** kiểu "Đã ký điện tử <ngày>". `null` = chưa ký.
Bỏ bước ký lại sau khi được duyệt (`POST /api/technician/contract/sign`), không dùng nữa.

## B. Điều khoản và chính sách (app khách và app KTV)

Admin đăng văn bản dạng PDF. App **không viết cứng** nội dung hay số phiên bản. Hai API **không cần token**.

| Việc | API |
|---|---|
| Danh sách: mỗi dòng `title` bên trái, `v{versionLabel}` bên phải. Rỗng → "Chưa có văn bản" | `GET /api/legal-documents?audience=TECHNICIAN` (app KTV) / `?audience=CUSTOMER` (app khách) |
| Bấm vào → mở PDF. Gọi lại mỗi lần mở (link 600 giây). `404` → tải lại danh sách | `GET /api/legal-documents/{code}` → mở `downloadUrl` |
| Link "Chính sách bảo mật" ở màn đăng ký (nếu có) | `GET /api/legal-documents/PRIVACY_POLICY` |

## C. Phí di chuyển (app khách và app KTV)

Quy tắc: **đơn tại nhà** có khoảng cách khách–KTV **vượt ngưỡng** (mặc định 10 km, admin chỉnh được) thì cộng
**một khoản cố định** (admin đặt). Phí này **KTV nhận 100%**, không tính hoa hồng. Đơn tại cơ sở, hoặc không biết vị
trí KTV, thì không có phí. Phí này **khác** `serviceFee` (phí phục vụ tại nhà 100.000đ, vẫn giữ nguyên).
**App không tự tính**, chỉ hiển thị số server trả về.

| Màn | Lấy ở đâu | Hiển thị |
|---|---|---|
| Danh sách KTV phù hợp (khách) | `POST /api/bookings/matching-technicians` → mỗi KTV có `travelFee` | `travelFee > 0` → ghi "+ Phí di chuyển 50.000đ" dưới KTV đó |
| Danh sách KTV ứng tuyển (khách) | `GET /api/bookings/{id}` → `applications[].travelFee` | Như trên, để khách biết trước khi chọn |
| Chi tiết đơn / thanh toán (khách) | `GET /api/bookings/{id}` → `travelFee`, `travelDistanceKm`, `totalAmount` | Thêm dòng "Phí di chuyển" khi `travelFee > 0`. `totalAmount` **đã gồm** phí |
| Đơn của KTV | `pricing.travelFee`, `pricing.technicianEarning` | "Bạn sẽ nhận được" (`technicianEarning`) **đã gồm** phí di chuyển; có thể ghi thêm dòng "Phí di chuyển" |

Lưu ý: với đơn mở, phí chỉ được chốt **khi chọn được KTV** (khách chọn, hoặc KTV được khách đặt bấm nhận). Trước đó
`travelFee` của đơn là `0`. Sau khi chốt, `totalAmount` và số tiền thanh toán tăng đúng bằng `travelFee`. Nếu cần hiện
quy tắc cho người dùng: `GET /api/settings/public` có `travelFeeThresholdKm` và `travelFeeAmount`.

## D. Quy tắc chung về link file

Mọi link file (`downloadUrl`, `signedDocumentUrl`, `viewUrl`…) **hết hạn sau 600 giây** vì là dữ liệu riêng tư.
Luôn gọi API lấy link mới ngay trước khi mở, không lưu link vào bộ nhớ hay cache.

## Cách tự kiểm tra trên Swagger

1. `PATCH /api/technician/application` với `idCardQr` = chuỗi app quét được → response có `idCardInfo` đúng tên trên thẻ.
2. `GET /api/technician/application/contract-preview` → mở `downloadUrl` → trang cuối có họ tên, số CCCD, ngày cấp, địa chỉ.
3. Ký và gửi theo A4 → `GET /api/technician/application/contract` → mở `signedDocumentUrl` → thấy chữ ký.

## Tài liệu chi tiết

- [technician-registration.md](technician-registration.md): đăng ký KTV, quét QR, ký hợp đồng
- [legal-documents.md](legal-documents.md): điều khoản và chính sách
