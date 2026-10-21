# Mobile: cấu hình dịch vụ và bảng giá KTV

Tài liệu này mô tả màn **Dịch vụ** của KTV theo thiết kế Figma. Mobile vẫn hiển thị toàn bộ dịch vụ Admin đã bật. Nơi phục vụ không phù hợp với Profile KTV chỉ bị khóa, không bị ẩn.

## Thông tin chung

```text
Base URL: http://149.28.156.66
```

Các request cần gửi:

```http
Authorization: Bearer <accessTokenKtv>
Content-Type: application/json
```

Token phải thuộc tài khoản đã được duyệt thành KTV và có `TechnicianProfile`.

## Luồng màn hình

```text
GET /api/service-catalog/technician
  -> hiển thị toàn bộ danh mục và dịch vụ
  -> dùng selected/canSelect để đánh dấu và khóa giao diện
  -> POST /api/technician/services khi KTV chọn dịch vụ
  -> PATCH /api/technician/services/{id} khi bỏ dịch vụ
  -> PATCH /api/technician/services/{id}/price-options/{optionId} khi đổi giá hoặc bật/tắt thời lượng
```

## 1. Lấy catalog cho màn Dịch vụ

```http
GET /api/service-catalog/technician
```

API trả về toàn bộ catalog đang hoạt động và trạng thái theo Profile KTV:

```json
{
  "profileServiceModes": ["HOME", "ONLINE"],
  "items": [
    {
      "id": "catalog-service-id",
      "category": {
        "id": "category-id",
        "name": "Massage - Giãn cơ"
      },
      "name": "Massage Cổ - vai - gáy",
      "description": null,
      "supportedModes": ["HOME"],
      "pricingTemplate": "STANDARD_60_90_120",
      "priceOptions": [
        { "id": "catalog-option-60", "durationMinutes": 60, "price": 500000 },
        { "id": "catalog-option-90", "durationMinutes": 90, "price": 600000 },
        { "id": "catalog-option-120", "durationMinutes": 120, "price": 700000 }
      ],
      "selectableModes": ["HOME"],
      "unavailableModes": [],
      "canSelect": true,
      "selected": true,
      "selectedServiceId": "technician-service-id",
      "selectedModes": ["HOME"],
      "selectedPriceOptions": [
        { "id": "option-60", "durationMinutes": 60, "price": 500000, "isActive": true },
        { "id": "option-90", "durationMinutes": 90, "price": 600000, "isActive": true },
        { "id": "option-120", "durationMinutes": 120, "price": 700000, "isActive": false }
      ]
    }
  ]
}
```

### Quy tắc hiển thị

| Field | Mobile xử lý |
|---|---|
| `category.name` | Gom dịch vụ theo nhóm; giữ thứ tự nhóm API trả về và đưa dịch vụ `selected: true` lên đầu mỗi nhóm |
| `selected: true` | Hiển thị dấu ✓ và thẻ cấu hình chi tiết |
| `selected: false` | Hiển thị checkbox để KTV thêm dịch vụ |
| `canSelect: false` | Vẫn hiển thị dịch vụ nhưng khóa checkbox/thẻ |
| `selectableModes` | Các nơi phục vụ được phép chọn |
| `unavailableModes` | Các nơi phục vụ phải hiển thị disabled |
| `selectedPriceOptions` | Giá và trạng thái gói riêng của KTV |

Không truyền `mode` vào endpoint này. Nếu gọi `GET /api/service-catalog?mode=HOME`, API sẽ lọc bớt dịch vụ và không phù hợp với màn hình KTV.

## 2. Nơi phục vụ

Các mã nơi phục vụ:

| Code | Nhãn hiển thị |
|---|---|
| `HOME` | Phục vụ tận nơi |
| `ONSITE` | Tại cơ sở |
| `ONLINE` | Online |

`selectableModes` được tính bằng giao giữa nơi phục vụ của catalog và `profileServiceModes` của KTV.

Ví dụ:

```text
Profile KTV: HOME
Catalog dịch vụ: HOME, ONSITE
Kết quả: HOME được chọn, ONSITE bị khóa
```

Nếu catalog chỉ có `ONSITE` nhưng Profile KTV chỉ có `HOME`, dịch vụ vẫn phải hiển thị nhưng `canSelect` là `false`. Mobile hiển thị gợi ý: **“Bật nơi phục vụ này trong Profile để sử dụng.”**

## 3. Thêm dịch vụ

Khi KTV chọn một dịch vụ và ít nhất một nơi phục vụ:

```http
POST /api/technician/services
```

```json
{
  "catalogServiceId": "catalog-service-id",
  "modes": ["HOME"]
}
```

`modes` chỉ được gửi các mã nằm trong `selectableModes`. Không gửi tên dịch vụ, giá hoặc thời lượng; các dữ liệu đó do catalog Admin quản lý.

Nếu catalog có `HOME`, `ONSITE`, `ONLINE` và Profile cũng bật cả ba, KTV có thể gửi:

```json
{
  "catalogServiceId": "catalog-service-id",
  "modes": ["HOME", "ONSITE", "ONLINE"]
}
```

## 4. Bỏ dịch vụ

Không xóa dữ liệu dịch vụ. Chỉ tắt dịch vụ:

```http
PATCH /api/technician/services/{technicianServiceId}
```

```json
{
  "isActive": false
}
```

Khi bật lại, gửi:

```json
{
  "isActive": true
}
```

## 5. Chọn thời lượng và chỉnh giá

Sau khi thêm dịch vụ, catalog đã tạo sẵn các gói giá. Mobile lấy danh sách chi tiết bằng:

```http
GET /api/technician/services/{technicianServiceId}/price-options
```

KTV có thể bật/tắt từng gói hoặc chỉnh giá:

```http
PATCH /api/technician/services/{technicianServiceId}/price-options/{optionId}
```

Ví dụ chỉ cung cấp 60 và 90 phút:

```json
{ "isActive": true, "price": 500000 }
```

```json
{ "isActive": true, "price": 600000 }
```

```json
{ "isActive": false }
```

Ba request trên lần lượt áp dụng cho gói 60, 90 và 120 phút. Backend không cho tắt toàn bộ gói; luôn phải còn ít nhất một gói hoạt động.

Khi khách đặt lịch, chỉ các `priceOptions` có `isActive: true` mới được dùng. Giá của gói không tự lấy từ catalog sau khi KTV đã chỉnh.

## 6. Cập nhật Profile nơi phục vụ

KTV thay đổi nơi phục vụ tại:

```http
PATCH /api/technician/profile
```

```json
{
  "serviceModes": ["HOME", "ONSITE", "ONLINE"]
}
```

Sau khi cập nhật Profile, mobile gọi lại `GET /api/service-catalog/technician` để cập nhật các checkbox bị khóa/mở. Không tự sửa `canSelect` ở phía client.

## 7. API lấy toàn bộ dịch vụ KTV

```http
GET /api/technician/services
```

API này trả các dịch vụ KTV đã tạo, gồm `catalogService`, `modes`, `isActive` và toàn bộ `priceOptions`. Có thể dùng để refresh màn hình sau khi thêm hoặc chỉnh dịch vụ.

## 8. Lỗi thường gặp

| HTTP | Nguyên nhân |
|---|---|
| `401` | Token thiếu, sai hoặc hết hạn |
| `403` | Tài khoản chưa được cấp quyền KTV |
| `404` | Chưa có Profile KTV hoặc catalog service không tồn tại |
| `400` | Gửi mode không thuộc `selectableModes`, hoặc gửi `modes` rỗng |
| `409` | Dịch vụ đã ở trạng thái không cho sửa |

Mobile không tự thêm giá mới, không tự đổi catalog và không tự ẩn dịch vụ không phù hợp Profile.
