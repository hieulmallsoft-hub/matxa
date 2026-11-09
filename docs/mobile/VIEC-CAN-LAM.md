# Việc mobile cần làm (cập nhật 06/11/2026)

Backend đã xong và đang chạy trên server. Swagger: http://149.28.156.66:5600/api/docs

## A. Đăng ký KTV (app KTV)

Luồng màn hình: **Chụp CCCD + quét QR → Chụp khuôn mặt → Xem hợp đồng đã điền sẵn → Tick + ký tay → Gửi hồ sơ**

> Hiện trạng (06/11): app **đã gửi chuỗi QR** và **đã mở hợp đồng từ `contract-preview`**; server đã tự điền
> thông tin Bên A vào trang 1 của mẫu hợp đồng. A1 và A3 coi như xong, chỉ cần giữ đúng như mô tả bên dưới.

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

### A2b. Bắt buộc có số điện thoại (KTV đăng ký mới và KTV đã duyệt)

Khách cần gọi được cho KTV, nên tài khoản đăng nhập bằng Google/Apple/email (chưa có số điện thoại) phải thêm số.

| Trường hợp | Server trả | App làm |
|---|---|---|
| Gửi hồ sơ KTV khi chưa có số | `400`, `missingFields` có `"phoneNumber"` ("Ho so con thieu: so dien thoai") | Đưa về màn nhập số điện thoại |
| KTV đã duyệt nhưng chưa có số | `GET /api/profile/me` → `"phoneRequired": true` | Sau khi đăng nhập, **bắt buộc** hiện màn nhập số điện thoại, chưa nhập thì không vào app được |
| KTV chưa có số bấm nhận đơn (**chỉ khi admin bật** "Bắt buộc KTV có số điện thoại" trong Cài đặt; hiện đang tắt) | `409`, `"code": "PHONE_REQUIRED"` ("Vui long cap nhat so dien thoai truoc khi nhan don") | Hiện "Bạn cần cập nhật số điện thoại để nhận đơn" và mở màn nhập số, **không** hiện chung chung "Chưa nhận được đơn" |

#### Lỗi khi KTV bấm "Nhận đơn" (`POST /api/technician/jobs/{id}/apply` hoặc `/accept`)

App đang hiện chung "Đơn này không còn nhận ứng tuyển" cho **mọi** lỗi 409, nên KTV không biết vì sao không nhận được. Cần hiện theo `code`/`message` server trả:

| Server trả | Nghĩa | App hiện |
|---|---|---|
| `409 "So du vi khong du de nhan don"` | Ví KTV không đủ tiền trả hoa hồng đơn này | "Số dư ví không đủ để nhận đơn" + nút **Nạp tiền** |
| `409`, `code: "PHONE_REQUIRED"` | Chưa có số điện thoại (chỉ khi admin bật) | Mở màn nhập số điện thoại |
| `409 "BOOKING_EXPIRED"` | Hết thời gian chờ nhận | "Đơn đã hết hạn" |
| `409 "Don khong con mo de ung tuyen"` / `"Don khong con mo"` | KTV khác đã nhận hoặc khách đã hủy | "Đơn này không còn nhận ứng tuyển" (câu hiện tại) |
| `403 "Tai khoan KTV chua du dieu kien nhan don"` | Tài khoản KTV chưa duyệt hoặc đang bị khóa | "Tài khoản chưa đủ điều kiện nhận đơn, liên hệ CSKH" |
| Lỗi khác | — | Hiện nguyên `message` server trả |

Lưu số điện thoại **có xác minh OTP** (dùng 2 API này, không dùng `PATCH /api/profile/me` vì không xác minh số):

```http
POST /api/auth/phone/link/send-otp
{ "phoneNumber": "0901234567", "deviceId": "<id máy>" }
→ { "challengeId": "…", "expiresIn": 300, "resendAfter": 60 }

POST /api/auth/phone/link/verify-otp
{ "challengeId": "…", "code": "123456", "deviceId": "<id máy>" }
→ thông tin tài khoản, có "phoneNumber" và "phoneVerified": true
```

Xong thì gọi lại `GET /api/profile/me`, thấy `phoneRequired: false` là được.

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
| Đơn của KTV | `pricing.serviceFee`, `pricing.travelFee`, `pricing.technicianEarning` | "Bạn sẽ nhận được" (`technicianEarning`) **đã gồm** phụ phí đơn tại nhà và phí di chuyển (KTV nhận 100% hai khoản này, sàn chỉ lấy hoa hồng trên giá dịch vụ); có thể ghi thêm dòng "Phụ phí", "Phí di chuyển" |

Lưu ý: với đơn mở, phí chỉ được chốt **khi chọn được KTV** (khách chọn, hoặc KTV được khách đặt bấm nhận). Trước đó
`travelFee` của đơn là `0`. Sau khi chốt, `totalAmount` và số tiền thanh toán tăng đúng bằng `travelFee`. Nếu cần hiện
quy tắc cho người dùng: `GET /api/settings/public` có `travelFeeThresholdKm` và `travelFeeAmount`.

## D. KTV gửi khiếu nại (app KTV)

KTV giờ khiếu nại được về đơn của mình, **dùng đúng các API khách đang dùng**. Mỗi bên (khách, KTV) khiếu nại **1 lần
cho mỗi đơn**; khách và KTV **không thấy khiếu nại của nhau**, mỗi bên chat riêng với CSKH.

| Việc | API | Ghi chú |
|---|---|---|
| Hiện nút "Khiếu nại" | Đơn của KTV có `canComplain: true` | Có trong danh sách/chi tiết đơn của KTV, khi đơn đã nhận, đã xong hoặc đã hủy |
| Đã khiếu nại rồi | Đơn có `complaint` (`id`, `status`, `statusLabel`, `conversationId`) | Nút "Xem khiếu nại" mở chat `conversationId` |
| Upload ảnh minh chứng | `POST /api/bookings/{id}/complaint-evidence-upload-url` | Giống khách |
| Gửi khiếu nại | `POST /api/bookings/{id}/complaint` | Body giống khách: `reasonCode`, `detail`, `contactEmail`, `evidenceStorageKeys` |
| Xem khiếu nại + đầu khung chat | `GET /api/bookings/{id}/complaint` | Có thêm `reporterRole` và `customer` (tên, ảnh khách) để hiện ở đầu chat |

Lý do cho KTV chọn (`reasonCode`):

| Mã | Hiện |
|---|---|
| `CUSTOMER_NO_SHOW` | Khách không có mặt, không liên lạc được |
| `CUSTOMER_BEHAVIOR` | Thái độ của khách |
| `PAYMENT_ISSUE` | Thanh toán (ví dụ khách không trả tiền mặt) |
| `SAFETY_ISSUE` | Vấn đề an toàn |
| `OTHER` | Lý do khác |

Lỗi: `409 "Lich dat da duoc tao khieu nai"` = KTV đã khiếu nại đơn này rồi → mở khiếu nại cũ.

## E. Đăng xuất, đổi mật khẩu, xóa tài khoản (app khách và app KTV)

API đã có sẵn, chỉ cần nối vào màn Cài đặt / Tài khoản.

### Đăng xuất

| Nút | API | Ghi chú |
|---|---|---|
| "Đăng xuất" | `POST /api/auth/logout` | Body `{ "deviceToken": "<FCM token của máy>" }` (có thể bỏ trống). Trả `204`. Máy này **thôi nhận thông báo** của tài khoản |
| "Đăng xuất khỏi mọi thiết bị" (nếu có) | `POST /api/auth/logout-all` | Trả `204`. Mọi máy thôi nhận thông báo |

Sau khi gọi (kể cả khi API lỗi mạng): **xóa accessToken và refreshToken** trong máy rồi về màn đăng nhập.
Token cũ dùng lại sẽ nhận `401`.

### Đổi mật khẩu

Chỉ tài khoản **đăng ký bằng email** mới có mật khẩu. `GET /api/auth/me` có `hasPassword`:
`true` → hiện nút "Đổi mật khẩu"; `false` (đăng nhập Google/Apple/số điện thoại) → **ẩn** nút.

```http
POST /api/auth/password/change
Authorization: Bearer <token>
{ "currentPassword": "matkhaucu", "newPassword": "matkhaumoi123" }
→ 200 { "changed": true }
```

- Mật khẩu mới **tối thiểu 8 ký tự**.
- Thành công: máy đang dùng **vẫn đăng nhập**, các máy khác bị đăng xuất.
- Lỗi `400`: `"Mat khau hien tai khong dung"` · `"Mat khau moi phai khac mat khau hien tai"` ·
  `"Tai khoan khong dang nhap bang mat khau"` (không nên xảy ra nếu đã ẩn nút theo `hasPassword`).
- Gọi tối đa 5 lần/phút; quá thì `429`.

Quên mật khẩu (ở màn đăng nhập) dùng 3 API có sẵn: `POST /api/auth/password/forgot/start` → `/verify-otp` → `/complete`.

### Xóa tài khoản

Nút "Xóa tài khoản" ở màn Tài khoản (App Store và Google Play đều bắt buộc có). Hiện hộp xác nhận nói rõ
**không khôi phục được**; tài khoản có mật khẩu (`hasPassword: true`) thì bắt nhập mật khẩu.

```http
POST /api/auth/account/delete
Authorization: Bearer <token>
{ "password": "matkhau" }        ← bỏ trống nếu hasPassword = false
→ 200 { "deleted": true }
```

Thành công: **xóa token trong máy, về màn đăng nhập** (mọi máy đã bị đăng xuất, không nhận thông báo nữa).
Người dùng có thể đăng ký lại bằng chính số điện thoại / email / Google đó như tài khoản mới.

| Lỗi | Ý nghĩa | App hiện |
|---|---|---|
| `400 "Mat khau khong dung"` | Sai hoặc thiếu mật khẩu | "Mật khẩu không đúng" |
| `409`, `code: "ACTIVE_BOOKINGS"` | Còn đơn đang diễn ra (`activeBookings` = số đơn) | "Bạn còn N đơn đang diễn ra. Hoàn thành hoặc hủy đơn trước khi xóa tài khoản" |
| `409`, `code: "WALLET_NOT_EMPTY"` | Ví KTV còn tiền (`walletBalanceVnd`) | "Ví còn X đ. Vui lòng liên hệ CSKH trước khi xóa tài khoản" |

## F. Danh sách KTV: 1 request thay vì ~43 (app khách)

Hiện app gọi danh sách, rồi gọi chi tiết và lịch trống **từng KTV** để hiện "Sớm nhất 15:30" và ẩn KTV hết chỗ. Mở
danh sách khoảng 43 request, cả văn phòng chung 1 IP nên dễ chạm giới hạn request của máy chủ và bị chặn (`429`). Giờ backend
tính sẵn, **app chỉ gọi 1 lần**:

```http
GET /api/marketplace/technicians?city=HN&categoryId=…&mode=HOME&date=2026-11-06&latitude=…&longitude=…&onlyAvailable=true&sort=availability
```

| Tham số mới | Ý nghĩa |
|---|---|
| `city` | Mã thành phố (`HN`…). Server lọc luôn, **bỏ** bước tự lọc bằng `/locations/cities` |
| `date` | Ngày `YYYY-MM-DD` (giờ VN) để tính giờ trống. Bỏ trống = hôm nay |
| `onlyAvailable=true` | Bỏ KTV hết chỗ trong ngày `date`. `total` và phân trang tính sau khi lọc |

Mỗi KTV có **`nextAvailableAt`**: giờ bắt đầu sớm nhất còn đặt được trong ngày `date`, theo gói ngắn nhất của các
dịch vụ khớp bộ lọc (`categoryId`, `serviceId`, `mode`). `null` = hết chỗ. Hiện "Sớm nhất HH:mm" theo giờ VN.

Khi đó:

- **Danh sách:** 1 request (bỏ vòng lặp gọi `technicians/{id}` và `…/availability` cho từng KTV).
- **Mở 1 KTV:** 1 request `GET /api/marketplace/technicians/{id}`.
- **Đặt lịch:** gọi `…/{id}/availability` 1 lần cho đúng dịch vụ và gói khách đã chọn, như hiện nay.

## G. Lịch sử hoạt động của KTV (app KTV)

Màn "Lịch sử hoạt động": KTV xem mình đã phục vụ bao nhiêu khách **hôm nay / tuần này / tháng này**. 1 request:

```http
GET /api/technician/jobs/activity
Authorization: Bearer <token KTV>
```

```json
{
  "timezone": "Asia/Ho_Chi_Minh",
  "today": { "from": "…", "to": "…", "completedBookings": 2, "customers": 1, "earning": 500000 },
  "week":  { "from": "…", "to": "…", "completedBookings": 3, "customers": 2, "earning": 650000 },
  "month": { "from": "…", "to": "…", "completedBookings": 4, "customers": 3, "earning": 650000 },
  "recent": [
    { "bookingId": "…", "code": "ECEE5154", "scheduledStart": "…", "scheduledEnd": "…", "mode": "HOME",
      "customer": { "displayName": "Tester", "avatarUrl": "…" },
      "services": [{ "name": "Massage body", "durationMinutes": 90 }], "earning": 300000 }
  ]
}
```

| Trường | Hiện |
|---|---|
| `completedBookings` | Số đơn đã hoàn thành trong kỳ |
| `customers` | Số khách đã phục vụ (1 khách đặt 2 lần tính 1) |
| `earning` | Thu nhập của KTV (đã trừ hoa hồng, đã gồm phí di chuyển) |
| `recent` | 20 đơn hoàn thành gần nhất, mới nhất trên cùng; bấm vào mở `GET /api/technician/jobs/{bookingId}` |

Chỉ tính đơn **đã hoàn thành**, theo **giờ hẹn**, giờ Việt Nam; tuần bắt đầu **thứ Hai**, tháng từ ngày 1.

## H. Ảnh hồ sơ và chứng chỉ của KTV (app KTV + app khách)

Trước đây server **khóa** ảnh khi hồ sơ đã gửi/đã duyệt (`409`), nên bấm lưu xong ảnh không hiện. Giờ KTV thêm/xóa
ảnh **bất cứ lúc nào**, kể cả sau khi được duyệt. Ảnh mới ở trạng thái **chờ duyệt**; admin duyệt xong khách mới thấy.

Màn "Thông tin dịch vụ" của KTV:

- Đổi chữ **"Hình ảnh dịch vụ" → "Ảnh hồ sơ"**, **bỏ** dòng "hình ảnh không gian làm việc hoặc kết quả dịch vụ".
- Thêm mục **"Chứng chỉ"** bên dưới: không bắt buộc, **tối đa 2 ảnh**. Ảnh hồ sơ tối đa **6 ảnh**.

| Việc | API | Ghi chú |
|---|---|---|
| Lấy link upload (dùng chung cho cả 2 loại) | `POST /api/technician/application/gallery-upload-url` | Body `{ "contentType": "image/jpeg", "size": <bytes> }` → `{ uploadUrl, mediaKey, expiresIn: 300 }`. `PUT` file lên `uploadUrl` với header `Content-Type` **đúng** contentType đã gửi, trong 5 phút. Bước lưu gửi `storageKey = mediaKey` |
| Lưu ảnh hồ sơ | `POST /api/technician/application/gallery` | `{ "storageKey": "…", "kind": "GALLERY" }` |
| Lưu chứng chỉ | `POST /api/technician/application/gallery` | `{ "storageKey": "…", "kind": "CERTIFICATE" }` |
| Xóa ảnh | `DELETE /api/technician/application/gallery/{id}` | |
| Xem lại ảnh của mình | `GET /api/technician/application` → `gallery[]` | Mỗi ảnh có `kind`, `status` (`PENDING` / `APPROVED` / `REJECTED`), `rejectionReason`, `viewUrl` |

- Response khi lưu có luôn `viewUrl` → **hiện ảnh ngay**, kèm nhãn "Chờ duyệt" nếu `status = PENDING`.
- `status = REJECTED` → hiện `rejectionReason` (KTV cũng nhận thông báo), cho xóa và tải ảnh khác.
- Lỗi `400 "Toi da 6 anh ho so"` / `"Toi da 2 anh chung chi"`.

**App khách**, trang chi tiết KTV `GET /api/marketplace/technicians/{id}` có thêm `gallery[]` và `certificates[]`
(chỉ ảnh đã duyệt; mỗi ảnh `{ id, viewUrl, expiresIn }`, link hết hạn sau 300 giây, mở lại trang thì gọi lại API).

## I. Quy tắc chung về link file

Mọi link file (`downloadUrl`, `signedDocumentUrl`, `viewUrl`…) **hết hạn sau 600 giây** vì là dữ liệu riêng tư.
Luôn gọi API lấy link mới ngay trước khi mở, không lưu link vào bộ nhớ hay cache.

## J. Giảm chiết khấu khi KTV làm đủ đơn trong ngày (app KTV, không bắt buộc)

Admin đặt trong Cài đặt → Chính sách KTV, ví dụ "5 đơn/ngày → phí còn 20%". KTV đã **hoàn thành** đủ 5 đơn trong ngày (giờ Việt Nam) thì các đơn nhận tiếp theo hôm đó chỉ bị trừ 20%. Các đơn trước mốc giữ nguyên phí.

- Không cần sửa gì để tính đúng tiền: `pricing.platformFee` / `pricing.technicianEarning` trong `GET /technician/jobs` và `GET /technician/jobs/{id}` đã tính theo mức giảm khi KTV đạt mốc.
- Nếu muốn hiện dòng "Làm thêm X đơn hôm nay để phí chỉ còn 20%": lấy `dailyDiscountThreshold`, `dailyDiscountFeePercent` từ `GET /settings/public` (`dailyDiscountThreshold = 0` là đang tắt, khi đó ẩn dòng này). Số đơn đã hoàn thành hôm nay lấy ở `today.completedBookings` của `GET /technician/jobs/activity`.

## K. Mã giảm giá khi đặt đơn (app khách) — sửa lỗi 6/11

Trước đây đơn đặt qua `POST /api/bookings` (đơn mở, có hoặc không chọn KTV) **bỏ qua** `promotionCode`, nên sau khi KTV nhận đơn chi tiết không có giảm giá. Đã sửa:

- Gửi `promotionCode` trong body `POST /api/bookings` như cũ. Server kiểm tra mã ngay lúc tạo đơn; mã sai/hết lượt trả `400` ("Ma khuyen mai khong hop le hoac da het han" / "Ma khuyen mai da het luot su dung" / "Don hang chua dat gia tri toi thieu") → hiện lỗi ở ô mã, **không** tạo đơn.
- `GET /api/bookings/{id}` có `discount` / `discountAmount`, `totalAmount` **đã trừ** giảm giá. Khi KTV được chốt mà có phí di chuyển thì `totalAmount` cộng thêm phí, giảm giá giữ nguyên.
- **Sàn chịu** phần giảm giá. Khách trả tiền mặt cho KTV ít hơn, nên lúc KTV nhận đơn, ví KTV được **cộng** đúng phần giảm giá (giao dịch `PROMOTION_CREDIT`) rồi mới trừ hoa hồng (`COMMISSION_DEBIT`). Đơn bị hủy thì đảo lại cả hai (`COMMISSION_REFUND` và `PROMOTION_CREDIT_REVERSAL`).

**Màn "Chi tiết đơn" của KTV** — dùng `pricing` trong `GET /api/technician/jobs/{id}`:

| Dòng trên màn | Trường | Ví dụ (DV 500k + phụ phí 100k, mã −250k, phí sàn 20%) |
|---|---|---|
| Tổng thu từ khách (tiền mặt) | `pricing.customerPaysAmount` | 350.000đ |
| Psyocore bù mã giảm giá (vào ví) | `pricing.discountAmount` (ẩn nếu 0) | +250.000đ |
| Phí gửi về Psyocore (trừ ví) | `pricing.platformFee` | −100.000đ |
| **Thực nhận** | `pricing.technicianEarning` | **500.000đ** (= 350k tiền mặt + 250k − 100k) |

`pricing.netToPlatform` = phí − tiền bù; **âm** nghĩa là Psyocore trả thêm cho KTV (ví dụ trên: −150.000đ → "Ví được cộng 150.000đ").
Khi nhận đơn, ví chỉ cần đủ `netToPlatform` (nếu dương), không cần đủ toàn bộ phí.

**Lịch sử ví** (`GET /api/wallet/transactions`) có thêm 2 loại, `title` server đã trả sẵn tiếng Việt:
`PROMOTION_CREDIT` "Psyocore bù mã giảm giá của khách" (dương), `PROMOTION_CREDIT_REVERSAL` "Thu lại tiền bù mã giảm giá (đơn bị hủy)" (âm).

## L. KTV chat với CSKH — "Hỗ trợ nhanh" (app KTV)

KTV dùng **đúng API chat CSKH của app khách**, không có API mới. Trước đây server trả `403` khi KTV mở chat này; nay đã mở.

| Việc | API |
|---|---|
| Mở (hoặc mở lại) cuộc chat CSKH của mình | `POST /api/conversations/support` — **không cần body** → `{ id, type: "SUPPORT", participant: { displayName: "Psyocore CSKH" } }` |
| Lấy tin nhắn | `GET /api/conversations/{id}/messages` |
| Gửi tin (text/ảnh) | `POST /api/conversations/{id}/messages`; ảnh: `POST /api/conversations/{id}/image-upload-url` trước |
| Đánh dấu đã đọc | như chat khách |
| Realtime | socket chat như app khách |

- Mỗi KTV có **một** cuộc chat CSKH; bấm "Hỗ trợ nhanh" nhiều lần vẫn ra cùng cuộc chat.
- Admin trả lời ở trang **Tin nhắn CSKH**, cuộc chat của KTV có nhãn **KTV**.
- Admin bấm "Kết thúc" hoặc 24 giờ không ai nhắn thì phiên **kết thúc nhưng không bị xóa**: vẫn nằm trong "Cuộc trò chuyện gần đây", chỉ xem được (`canSendMessage: false`, `endedAt`). Bấm "Chat ngay" mở cuộc **mới**.
- Người dùng (khách/KTV) xóa cuộc cũ: `DELETE /api/conversations/{id}` — chỉ ẩn ở phía mình; admin xóa cũng chỉ ẩn ở phía admin.
- Áp dụng cho **cả app khách và app KTV**; chi tiết và cách xử lý trên màn hình ở [support-chat.md](support-chat.md).
- Có thể **dùng lại nguyên màn chat CSKH** của app khách; chi tiết API xem [support-chat.md](support-chat.md).

## Cách tự kiểm tra trên Swagger

1. `PATCH /api/technician/application` với `idCardQr` = chuỗi app quét được → response có `idCardInfo` đúng tên trên thẻ.
2. `GET /api/technician/application/contract-preview` → mở `downloadUrl` → trang cuối có họ tên, số CCCD, ngày cấp, địa chỉ.
3. Ký và gửi theo A4 → `GET /api/technician/application/contract` → mở `signedDocumentUrl` → thấy chữ ký.

## Tài liệu chi tiết

- [technician-registration.md](technician-registration.md): đăng ký KTV, quét QR, ký hợp đồng
- [legal-documents.md](legal-documents.md): điều khoản và chính sách
