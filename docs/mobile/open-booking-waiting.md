# Mobile: Màn chờ KTV, chọn KTV, hủy và từ chối đơn

Hướng dẫn cho cả **app khách** và **app KTV**, theo các màn Figma "Vui lòng chờ kỹ thuật viên
xác nhận", "N KTV đang muốn phục vụ bạn", "Bạn muốn hủy đơn?" và thẻ đơn "Khách đặt bạn" /
"Yêu cầu mới" bên KTV.

Mọi request dùng `Authorization: Bearer <accessToken>`; base URL `/api`.

## Tóm tắt luồng

```
Khách đặt đơn (chọn KTV A)          → đơn OPEN, đếm ngược 15 phút
  ├─ KTV A nhận "Khách đặt bạn"     → Nhận đơn → đơn CONFIRMED NGAY cho KTV A
  │                                  → hoặc Từ chối
  ├─ KTV phù hợp khác "Yêu cầu mới" → Ứng tuyển (KTV thay thế)
  │
KTV A từ chối / chưa phản hồi        → khách bấm "Chọn" một KTV thay thế → đơn CONFIRMED
Khách bấm "Hủy đơn"                 → đơn CANCELLED
Hết 15 phút mà chưa có ai nhận      → đơn EXPIRED (tự động)
```

- **KTV A nhận đơn = đơn được xác nhận luôn**, khách không cần bấm "Chọn". KTV A **không bao giờ**
  nằm trong danh sách "N KTV đang muốn phục vụ bạn"; danh sách đó chỉ là KTV thay thế.
- KTV A từ chối **không hủy đơn**: đơn vẫn mở để khách chọn KTV khác đang ứng tuyển.

---

# Phần 1: App khách

## 1.1 Tạo đơn

```http
POST /api/bookings
```

Body như hiện tại, có `technicianId` là KTV khách chọn ở bước matching. Response có `bookingId`,
`bookingStatus: "OPEN"` và `expiresInSeconds` (số giây còn lại để chờ, theo `OPEN_BOOKING_APPLICATION_TTL_MINUTES`; Figma là 15 phút).

Backend kiểm tra KTV khách chọn **trước khi** tạo đơn. Nếu KTV đó không còn nhận được đơn, API trả lỗi và
**không tạo đơn**; app báo lý do và đưa khách về màn chọn KTV (gọi lại `POST /api/bookings/matching-technicians`):

| Lỗi | `message` |
|---|---|
| `409` | `KTV khong ranh trong khung gio nay` |
| `409` | `KTV da co lich trung thoi gian` |
| `409` | `KTV phai hoan thanh don hien tai truoc khi nhan don moi` |
| `403` | `KTV khong phu hop khu vuc cua don` / `KTV chua co dich vu phu hop voi don nay` / `KTV khong ho tro hinh thuc dich vu nay` |

Response tạo đơn có `canCancel` nhưng đó là cờ của KTV; cờ hủy của khách lấy từ `GET /api/bookings/{bookingId}` (mục 1.2).

## 1.2 Màn chờ

```http
GET /api/bookings/{bookingId}
```

Các trường dùng cho màn chờ:

| Trường | Dùng để |
|---|---|
| `status` | `OPEN` = đang chờ. Xem bảng trạng thái ở mục 1.6 |
| `applicationDeadlineAt` | Đếm ngược "Đơn đặt sẽ tự động hủy trong vòng 14:59" và "Thời gian chờ dự kiến chỉ còn ~3 phút" |
| `requestedTechnicianId` | ID KTV khách chọn ban đầu. Tên/ảnh KTV này app đã có từ bước matching, dùng cho dòng "Đang chờ **Kim Nguyễn** xác nhận" |
| `applications` | Danh sách KTV đã ứng tuyển ("9 KTV đang muốn phục vụ bạn") |
| `canCancel` | `true` thì hiện nút "Hủy đơn" |

Mỗi phần tử `applications`:

```json
{
  "applicationId": "uuid",
  "technicianId": "technician-profile-id",
  "displayName": "Nguyễn Thị Mai",
  "avatarUrl": "https://...",
  "averageRating": 4.8,
  "reviewCount": 15,
  "distanceKm": 2,
  "isAvailable": true,
  "badge": "QUALITY",
  "status": "APPLIED",
  "isSelected": false,
  "isApplicant": true,
  "appliedAt": "2026-11-03T08:00:00.000Z"
}
```

- **Chỉ hiện phần tử `isApplicant: true`.** `WITHDRAWN` là KTV đã rút ứng tuyển, `DECLINED` là
  KTV đã từ chối; không hiện các phần tử này.
- `averageRating`, `reviewCount` → "★4.8 (15 đánh giá)".
- `distanceKm` → "📍 2 km" (từ địa chỉ khách tới KTV). `null` khi đơn không tại nhà hoặc KTV chưa có vị trí → ẩn dòng này.
- `isAvailable: true` → "🕒 Sẵn sàng" (KTV đang bật nhận việc). `false` thì ẩn.
- `badge` → tag góc ảnh: `"QUALITY"` = **Chất lượng** (★ ≥ 4.5 và ≥ 10 đánh giá), `"NEW"` = **Mới**
  (KTV tham gia dưới 30 ngày), `null` = không gắn tag.

**Cập nhật danh sách:** khi nhận thông báo `TECHNICIAN_APPLIED` hoặc `REQUESTED_TECHNICIAN_DECLINED`
(mục 1.5), gọi lại `GET /api/bookings/{bookingId}`. Trong lúc đang mở màn chờ, tải lại khoảng
**10 giây/lần** vì push có thể đến chậm.

## 1.3 Chọn KTV (nút "Chọn")

```http
POST /api/bookings/{bookingId}/select-technician

{ "applicationId": "<applicationId>" }
```

Thành công: `bookingStatus: "CONFIRMED"`. Chuyển sang màn đơn đã xác nhận.

| Lỗi | Ý nghĩa | App làm gì |
|---|---|---|
| `400` "Ung tuyen khong hop le" | KTV đó vừa rút ứng tuyển | Tải lại danh sách |
| `409` "Don da duoc chon KTV, huy, hoac khong con mo" | Đơn đã hết hạn / đã hủy / đã chọn | Tải lại đơn, hiện theo `status` |
| `409` "Don dang duoc chon KTV, vui long thu lai" | Bấm hai lần cùng lúc | Thử lại sau 1 giây |

## 1.4 Hủy đơn (màn "Bạn muốn hủy đơn?")

Chỉ hiện nút khi `canCancel = true` (đơn `OPEN`, `PENDING` hoặc `CONFIRMED`).

```http
PATCH /api/bookings/{bookingId}/cancel

{ "reasonCode": "WAIT_TOO_LONG" }
```

| Lựa chọn trên màn | `reasonCode` |
|---|---|
| Thời gian chờ quá lâu | `WAIT_TOO_LONG` |
| Không muốn sử dụng dịch vụ nữa | `NO_LONGER_NEEDED` |
| Vấn đề về dịch vụ | `SERVICE_ISSUE` |
| Vấn đề thanh toán / hoàn tiền | `PAYMENT_REFUND_ISSUE` |
| Lý do khác | `OTHER` + `reasonText` (bắt buộc, tối đa 500 ký tự) |

- Gửi đúng mã trong bảng (viết hoa). **Mã khác trả `400`.**
- "Tiếp tục chờ" chỉ đóng màn, không gọi API.
- Thành công: response có `status: "CANCELLED"`. Các KTV đã ứng tuyển nhận thông báo đơn bị hủy.

| Lỗi | Ý nghĩa |
|---|---|
| `400` "Vui long nhap ly do khac" | Chọn "Lý do khác" mà không nhập nội dung |
| `400` "Lich dat khong the huy" | Đơn đã `COMPLETED`, `CANCELLED` hoặc `EXPIRED` |
| `409` "Trang thai lich dat da thay doi, vui long tai lai" | Đơn vừa đổi trạng thái (ví dụ vừa hết hạn); tải lại đơn |

## 1.5 Thông báo khách nhận

Đều có trong `GET /api/notifications` và push (data có `type`, `bookingId`).
`actionUrl = matxa://bookings/{bookingId}`: chạm vào thì mở đơn đó.

| `type` | Khi nào | App làm gì |
|---|---|---|
| `TECHNICIAN_APPLIED` | Có KTV thay thế ứng tuyển | Tải lại danh sách ứng viên |
| `REQUESTED_TECHNICIAN_ACCEPTED` | KTV khách chọn ban đầu đã nhận đơn → đơn `CONFIRMED`. Nội dung: "<tên> đã nhận đơn của bạn." | Tải lại đơn, chuyển sang màn "Đã kết nối" (chi tiết đơn, nhắn tin với KTV) |
| `REQUESTED_TECHNICIAN_DECLINED` | KTV khách chọn ban đầu từ chối: "<tên> đã từ chối đơn. Đơn vẫn mở để KTV khác nhận." **Hoặc** KTV đó vừa nhận đơn khác (mỗi KTV chỉ làm 1 đơn một lúc) nên backend tự từ chối thay: "<tên> đã nhận đơn khác nên không thể nhận đơn này. Đơn vẫn mở để KTV khác nhận." | Tải lại đơn; đổi dòng "Đang chờ <tên> xác nhận" thành mời chọn KTV khác |
| `BOOKING_EXPIRED` | Hết 15 phút chưa chọn KTV | Hiện "Đơn đã hết hạn" |
| `BOOKING_CANCELLED` | KTV đã được chọn hủy đơn | Hiện đơn đã hủy (nội dung chữ theo mẫu admin cấu hình, chỉ dựa vào `type`) |

## 1.6 Trạng thái đơn (`status`)

| `status` | Màn hình |
|---|---|
| `OPEN` | Màn chờ + danh sách ứng viên |
| `CONFIRMED` | Đã chọn KTV, đơn đã xác nhận |
| `EXPIRED` | "Đơn đã hết hạn", ẩn nút Chọn/Hủy |
| `CANCELLED` | Đơn đã hủy; `cancellation.reasonCode` là lý do |
| `COMPLETED` | Hoàn thành |

---

# Phần 2: App KTV

## 2.1 Nhận đơn mới

Khi khách tạo đơn, KTV phù hợp nhận thông báo (trong app + push):

| `type` | Người nhận | Thẻ đơn |
|---|---|---|
| `OPEN_BOOKING_REQUESTED` | KTV khách chọn | Cam, nhãn "Khách đặt bạn", có nút **Từ chối** + **Ứng tuyển** |
| `OPEN_BOOKING_AVAILABLE` | KTV phù hợp khác | Xanh, nhãn "Yêu cầu mới", chỉ nút **Ứng tuyển** |

Push data có thêm `requestType` (`CUSTOMER_REQUEST` / `MARKETPLACE`) và `requestLabel`.
Chạm thông báo → mở chi tiết đơn.

## 2.2 Danh sách và chi tiết

```http
GET /api/technician/jobs?city=Hà Nội&serviceIds=<id1>,<id2>,<id3>
GET /api/technician/jobs?status=COMPLETED          (chip "Đã hoàn thành")
GET /api/technician/jobs/{bookingId}
```

**Bộ lọc (Figma):**
- "Chọn thành phố" (chọn 1): danh sách lấy từ `GET /api/locations/cities` → gửi `city`.
- "Chọn dịch vụ" (chọn nhiều): danh sách lấy từ `GET /api/service-catalog` → gửi `serviceIds` (cách nhau dấu phẩy
  hoặc lặp lại `serviceIds=..&serviceIds=..`). Chip hiện "3 dịch vụ".
- "Xóa lọc": gọi lại không có `city`/`serviceIds`/`status`.

**`displayStatus`: nhãn của thẻ và màn chi tiết.** Mobile chỉ cần đọc trường này, không tự ghép các cờ:

| `displayStatus` | Thẻ / chi tiết (Figma) | Nút |
|---|---|---|
| `REQUESTED` | 🔥 "Khách đặt bạn" + đếm ngược | **Từ chối** + **Nhận đơn** |
| `NEW` | ☀️ "Yêu cầu mới" + đếm ngược | **Ứng tuyển** |
| `APPLIED` | Không nhãn; chi tiết: ⏳ "Đang chờ khách xác nhận" | "Đã ứng tuyển" (xám) |
| `NOT_SELECTED` | ⊗ "Không được chọn"; chi tiết: "Khách đã chọn KTV khác" | **Xem đơn khác** |
| `CANCELLED` | ⊗ "Đã hủy"; chi tiết: "Đơn đã được hủy" | **Xem đơn khác** |
| `EXPIRED` | "Hết hạn" (chữ đỏ) | — |
| `DECLINED` / `WITHDRAWN` | Đã từ chối / Đã rút | — |
| `ACCEPTED` | Đơn đã nhận: địa chỉ đầy đủ, quy định, "Gửi về Psyocore / Thực nhận / Tổng thu từ khách" | **Liên hệ khách**, **Đã hoàn thành** (khi `canComplete`) |
| `COMPLETED` | "Đã hoàn thành", "Bạn đã nhận được" | — |
| `UNAVAILABLE` | Đơn còn mở nhưng **KTV này không nhận được nữa** (đang có đơn khác chưa xong, hết khung giờ rảnh, ngoài bán kính…). Lý do ở `unavailableReason`. Hiện "Bạn không thể nhận đơn này" | Ẩn nút; **Xem đơn khác** |

**Mỗi KTV chỉ làm 1 đơn một lúc.** Khi KTV được nhận 1 đơn, backend tự:
- **rút** các ứng tuyển của KTV đó ở đơn khác → khách các đơn đó không còn thấy KTV này trong danh sách thay thế;
- **từ chối thay** các đơn khác mà khách đặt riêng KTV này → khách nhận `REQUESTED_TECHNICIAN_DECLINED`;
- các đơn "Yêu cầu mới" khác biến khỏi tab Nhận việc; mở từ thông báo cũ → `displayStatus: "UNAVAILABLE"` (không còn lỗi 409).
Hoàn thành đơn đang làm thì KTV lại thấy và nhận đơn mới bình thường.

Đếm ngược "12:05" = `applicationDeadlineAt` − giờ hiện tại (chỉ khi `REQUESTED`/`NEW`).

**Tiền (`pricing`):**
- "Bạn sẽ nhận được" = `pricing.technicianEarning`. Trước khi nhận đơn (`isEstimate: true`) đã **trừ sẵn hoa hồng**
  theo tỷ lệ hiện tại, nên khớp với "Thực nhận" sau khi nhận.
- Màn đơn đã nhận (`isEstimate: false`): "Gửi về Psyocore" = `platformFee`, "Thực nhận" = `technicianEarning`,
  "Tổng thu từ khách" = `totalAmount` (đã gồm phí phục vụ tại nhà nếu có).

| Trường | Dùng để |
|---|---|
| `requestType`, `requestLabel` | Kiểu thẻ và nhãn "Khách đặt bạn" / "Yêu cầu mới" |
| `canApply` | Hiện nút **Ứng tuyển** |
| `canDecline` | Hiện nút **Từ chối** (chỉ KTV "Khách đặt bạn") |
| `canWithdraw` | Hiện nút **Rút ứng tuyển** sau khi đã ứng tuyển |
| `applicationStatus` | `APPLIED` = "Đã ứng tuyển", chờ khách chọn |
| `bookingStatus` | `EXPIRED` → nhãn "Hết hạn" |
| `customerSelectedAnotherTechnician` | `true` = **đơn đã có KTV khác nhận** → thẻ hiện "Đã có KTV nhận", ẩn mọi nút. Đúng cho cả KTV đã ứng tuyển lẫn KTV chưa bấm gì (kể cả KTV "Khách đặt bạn") |
| `customer.gender`, `customer.nationality` | "Khách nữ, Việt Nam" |
| `addressText` | **Địa chỉ chi tiết** (số nhà, ngõ, phường, quận, TP) trên thẻ, chi tiết và sheet "Bạn muốn ứng tuyển đơn?". Có ngay từ khi KTV thấy đơn tại nhà |
| `addressPreview` | Bản rút gọn bỏ số nhà/ngõ ("… Tổ 2A, Bạch Mai, Hà Nội") nếu muốn hiện gọn |
| `district`, `city` | Dùng khi `addressText` là `null` (đơn tại cơ sở/online): "Hai Bà Trưng, Hà Nội". Tất cả `null` thì ẩn dòng địa chỉ |
| `address` | Object có toạ độ để mở bản đồ/chỉ đường; chỉ có sau khi KTV được nhận đơn |
| `distanceKm` | "Khoảng cách: 5km" trong sheet ứng tuyển. `null` khi KTV chưa cập nhật vị trí hoặc đơn không tại nhà → ẩn |
Dựa vào các cờ `can...` để hiện nút; không tự suy ra từ trạng thái.

## 2.3 Ứng tuyển, từ chối, rút

```http
POST /api/technician/jobs/{bookingId}/apply      (không body)
POST /api/technician/jobs/{bookingId}/decline    (không body)
POST /api/technician/jobs/{bookingId}/withdraw   (không body)
```

- **KTV "Khách đặt bạn" bấm nhận** (cùng API `/apply`): đơn **xác nhận ngay** cho KTV này và trừ hoa hồng luôn.
  Response `{ "status": "SELECTED", "bookingStatus": "CONFIRMED", ... }` → chuyển thẻ sang "Đã nhận",
  hiện thông tin liên hệ khách. Nên đổi nhãn nút thành **"Nhận đơn"** thay cho "Ứng tuyển" ở thẻ này.
  Khách nhận `REQUESTED_TECHNICIAN_ACCEPTED`; các KTV thay thế đang ứng tuyển nhận `TECHNICIAN_NOT_SELECTED`.
- **Ứng tuyển** (KTV "Yêu cầu mới"): tạo lượt `APPLIED`; khách nhận `TECHNICIAN_APPLIED`. Gọi lại nhiều lần không sao.
- **Sheet sau khi bấm** (Figma "Nhận đơn thành công"): dựa vào response của `/apply`.
  `bookingStatus: "CONFIRMED"` → hiện "Nhận đơn thành công — hãy gọi cho khách"; lúc này đã có
  `address` và số khách. Còn `status: "APPLIED"` (KTV "Yêu cầu mới") thì khách **chưa chọn** nên
  chưa có số để gọi → hiện "Đã ứng tuyển, chờ khách chọn"; khi nhận `TECHNICIAN_SELECTED` mới hiện sheet thành công.
  Ứng tuyển **chưa trừ tiền**; ví KTV thay thế chỉ bị trừ hoa hồng khi khách chọn KTV này (`COMMISSION_DEBIT`),
  và được hoàn lại nếu đơn bị hủy sau đó (`COMMISSION_REFUND`).
  Nhưng ví phải **đủ tiền hoa hồng** của đơn ngay lúc ứng tuyển (hoa hồng = tiền dịch vụ × % phí nền tảng),
  nếu không API trả `409 "So du vi khong du de nhan don"` → hiện "Số dư ví không đủ để nhận đơn này"
  kèm nút **Nạp ví**. Lỗi này cũng có thể xảy ra ở `POST /api/technician/jobs/{id}/accept` (đơn đặt thẳng).
- **Từ chối** (KTV "Khách đặt bạn"): đơn **không bị hủy**, chỉ bị ẩn khỏi danh sách của KTV này.
  Đơn vẫn mở cho KTV khác; khách nhận `REQUESTED_TECHNICIAN_DECLINED`.
- **Rút ứng tuyển:** chỉ khi đơn còn `OPEN` và đang `APPLIED`.

KTV chưa được chọn **không dùng** `/cancel`: API đó chỉ dành cho KTV đã được khách chọn
(xem [technician-booking-cancellation.md](technician-booking-cancellation.md)). Gọi khi chưa được
chọn sẽ nhận `403`.

## 2.4 Thông báo KTV nhận sau khi ứng tuyển

| `type` | Khi nào | App làm gì |
|---|---|---|
| `TECHNICIAN_SELECTED` | Khách chọn KTV này | Đơn chuyển sang "Đã nhận", hiện thông tin liên hệ |
| `TECHNICIAN_NOT_SELECTED` | Đơn đã có KTV khác nhận. Gửi cho **mọi KTV đơn đã tới** (đã ứng tuyển, đã nhận "Yêu cầu mới"/"Khách đặt bạn" mà chưa bấm gì), trừ KTV đã từ chối/rút. Nội dung: "Đơn này đã có KTV khác nhận." | Tải lại đơn → `customerSelectedAnotherTechnician: true` → thẻ "Đã có KTV nhận", không cho ứng tuyển. Chạm thông báo mở được chi tiết (không còn 403) |
| `BOOKING_CANCELLED` | Khách hủy đơn. Gửi cho **mọi KTV đã nhận "Yêu cầu mới"/"Khách đặt bạn"** của đơn và KTV đang ứng tuyển (trừ KTV đã từ chối/rút) | Mở `GET /api/technician/jobs/{bookingId}` → `bookingStatus: "CANCELLED"`, hiện thẻ "Đã hủy" |
| `BOOKING_EXPIRED` | Hết hạn, khách chưa chọn | Nhãn "Hết hạn" |

## Thử nhanh

1. App khách tạo đơn, chọn KTV A.
2. KTV A bấm Từ chối → khách nhận "A đã từ chối đơn…", đơn vẫn `OPEN`.
3. KTV B bấm Ứng tuyển → `GET /api/bookings/{id}` của khách có B trong `applications`.
4. Khách bấm Chọn B → `CONFIRMED`; B nhận `TECHNICIAN_SELECTED`.
5. Lặp lại với đơn mới, lần này khách bấm Hủy với `WAIT_TOO_LONG` → `CANCELLED`; KTV đã ứng tuyển
   nhận `BOOKING_CANCELLED`.
