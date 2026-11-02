# Mobile: Địa điểm (Massage/Spa, Phòng tham vấn)

Màn **Địa điểm** có 3 thẻ. Hai thẻ đầu gọi API địa điểm bên dưới với `category`;
thẻ **Khóa học** mở danh sách khóa học online (API khóa học), không phải địa điểm.

| Thẻ | `category` |
|---|---|
| Massage/spa | `MASSAGE_SPA` |
| Phòng tham vấn | `CONSULTATION` |

Ảnh và câu phụ của từng thẻ ("Thư giãn - Tái tạo"…) là nội dung cố định trên app.
Các API đọc không cần đăng nhập, trừ khi ghi rõ.

## Danh sách

```http
GET /api/venues?category=MASSAGE_SPA&latitude=21.0285&longitude=105.8542&sort=distance
```

| Query | Ý nghĩa |
|---|---|
| `category` | Bắt buộc theo thẻ đang mở |
| `latitude`, `longitude` | Vị trí người dùng. Có cả hai thì mỗi địa điểm có `distanceKm` |
| `sort` | `rating` (mặc định) hoặc `distance` (cần vị trí) |
| `minRating` | Bộ lọc **Đánh giá**: `4` nghĩa là từ 4 sao trở lên |
| `city`, `district` | Bộ lọc **Địa điểm** |
| `search` | Tìm theo tên |

Response là **mảng** (không có `items`). "128 địa điểm được tìm thấy" là độ dài mảng.
Mỗi phần tử dùng cho thẻ trong danh sách:

```json
{
  "id": "venue-uuid",
  "name": "Mạc Thị - Spa cho Nam",
  "category": "MASSAGE_SPA",
  "images": ["https://cdn/.../1.jpg"],
  "rating": 4.4,
  "reviewCount": 8565,
  "distanceKm": 1.7,
  "isVerified": true,
  "phone": "0901234567",
  "offer": { "discountLabel": "-40%", "...": "xem mục Ưu đãi" }
}
```

- Ảnh thẻ: `images[0]`. Không có ảnh thì dùng ảnh mặc định.
- Nhãn đỏ góc ảnh: `offer.discountLabel`. `offer = null` thì không hiện nhãn.
- `distanceKm = null` khi app không gửi vị trí: ẩn dòng khoảng cách.
- `reviewCount = 0`: hiện "Chưa có đánh giá" thay vì 0 sao.

## Chi tiết

```http
GET /api/venues/{id}?latitude=21.0285&longitude=105.8542
```

Trả mọi trường ở danh sách, thêm:

| Trường | Hiển thị |
|---|---|
| `images` | Băng chuyền ảnh, "1/4" là vị trí / `images.length` |
| `isVerified` | Dấu tích xanh cạnh tên |
| `services[]` | Mục **Dịch vụ**: `name`, `durationMinutes`, `price` (VND) |
| `offer` | Thẻ ưu đãi "Giảm 40% dịch vụ massage – Có hiệu lực đến 30 tháng 11" |
| `address`, `latitude`, `longitude` | Mục **Địa điểm**; nút mũi tên mở bản đồ chỉ đường bằng tọa độ |
| `hours[]` | Mục **Giờ mở cửa** |
| `reviewSummary`, `latestReviews` | Mục **Đánh giá** |
| `phone` | Nút **Gọi** (`tel:`). `null` thì ẩn nút |

**Giờ mở cửa:** `hours[]` gồm `dayOfWeek` (0 = Chủ nhật, 1 = Thứ Hai … 6 = Thứ Bảy),
`openTime`, `closeTime` dạng `HH:mm`, `isClosed`. `isClosed: true` hiện chữ đỏ "Đóng cửa".
Ngày không có trong mảng là chưa cập nhật. Dòng thu gọn ("Thứ Hai - Chủ Nhật 09:00 - 22:00")
do app tự gộp các ngày cùng giờ.

## Ưu đãi

`offer` chỉ có khi mã khuyến mãi admin gắn vào địa điểm đang bật và còn hạn. Bấm **Xem ưu đãi**
mở màn chi tiết, dùng ngay dữ liệu này (không cần gọi thêm API):

```json
{
  "id": "promotion-uuid",
  "code": "SPA40",
  "title": "Giảm 40% dịch vụ massage",
  "type": "PERCENT",
  "value": 40,
  "discountLabel": "-40%",
  "minOrderAmount": 0,
  "maxDiscount": null,
  "startsAt": "2026-11-01T00:00:00.000Z",
  "endsAt": "2026-11-30T16:59:59.000Z",
  "description": "Mục Thông tin",
  "terms": "Mục Điều khoản và điều kiện",
  "note": "Mục Lưu ý"
}
```

Tiêu đề màn ("Giảm 50%") lấy từ `discountLabel` hoặc `title`. Mục nào `null` thì ẩn.
`type: "FIXED"` thì `discountLabel` dạng `-50.000đ`.
Đây là mã khuyến mãi của hệ thống: hiện `code` để khách dùng khi đặt lịch trong app.

## Đánh giá

`reviewSummary` dùng cho khối điểm trung bình và biểu đồ:

```json
{ "average": 4.9, "count": 24, "distribution": { "1": 0, "2": 0, "3": 0, "4": 2, "5": 22 } }
```

Thanh của mỗi mức sao = `distribution[n] / count`. `latestReviews` là 3 đánh giá mới nhất.

**Xem tất cả:**

```http
GET /api/venues/{id}/reviews?page=1&limit=20&rating=5
```

Response `{ items, total, page, limit, summary }`. `rating` (tùy chọn) lọc đúng số sao.
Mỗi đánh giá:

```json
{
  "id": "review-uuid",
  "rating": 5,
  "comment": "Kỹ thuật tốt, thái độ nhẹ nhàng.",
  "createdAt": "2026-10-31T08:00:00.000Z",
  "reviewer": { "displayName": "••••••••••g", "avatarUrl": null }
}
```

Tên đã được backend che sẵn, app hiển thị nguyên. "2 ngày trước" do app tính từ `createdAt`.

**Khách viết đánh giá** (cần Bearer token của khách):

```http
POST /api/venues/{id}/reviews
{"rating": 5, "comment": "Kỹ thuật tốt"}
```

Mỗi khách một đánh giá cho mỗi địa điểm; gửi lại sẽ sửa đánh giá cũ. `comment` tùy chọn,
tối đa 2000 ký tự. KTV/admin nhận `403`. Đánh giá bị admin ẩn sẽ không hiện và không tính vào
điểm trung bình.

```http
GET /api/venues/{id}/reviews/mine
```

Trả đánh giá của chính khách hoặc `null`, dùng để điền sẵn form khi sửa.

## Nhắn để đặt

Cần Bearer token của khách:

```http
POST /api/conversations/support
{"venueId": "venue-uuid"}
```

Backend mở chat CSKH của khách (giống nút "Chat ngay") và gửi thay khách tin
"Mình muốn đặt lịch tại <tên> (<địa chỉ>)." để CSKH biết khách hỏi địa điểm nào.
Response là hội thoại hỗ trợ kèm `inquiryMessage`; mở màn chat bằng `id`.
Chi tiết chat xem [support-chat.md](support-chat.md).
