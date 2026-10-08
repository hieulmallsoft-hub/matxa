# Marketplace API - Mobile Integration

## 1. Chức năng và màn hình sử dụng

Dùng cho Home Marketplace, danh sách/tìm kiếm KTV, filter chips, nearby technicians, Technician Detail và danh sách yêu thích. Empty state không cần endpoint riêng.

## 2. Authentication

Home, categories, list và detail là public. Guest không gửi Authorization vẫn dùng được.

```http
Authorization: Bearer <access_token>
```

Nếu gửi Bearer token, token phải hợp lệ và session còn active. Token chỉ ảnh hưởng `isFavorite`; không dùng `userId` từ query. Favorites API bắt buộc Bearer token.

## 3. Endpoints

| Method | Endpoint                           | Chức năng                                       | Auth     |
| ------ | ---------------------------------- | ----------------------------------------------- | -------- |
| GET    | `/api/marketplace/home`            | Banner hiệu lực, category active, tối đa 10 KTV | Optional |
| GET    | `/api/marketplace/categories`      | Category active                                 | Public   |
| GET    | `/api/marketplace/technicians`     | Search, filter, sort, pagination                | Optional |
| GET    | `/api/marketplace/technicians/:id` | Detail KTV, services, reviews                   | Optional |
| GET    | `/api/favorites`                   | KTV yêu thích current user                      | Bearer   |
| POST   | `/api/favorites/:technicianId`     | Thêm yêu thích, idempotent                      | Bearer   |
| DELETE | `/api/favorites/:technicianId`     | Bỏ yêu thích                                    | Bearer   |

## 4. Home Marketplace

```http
GET /api/marketplace/home?latitude=10.7769&longitude=106.7009
```

`latitude` và `longitude` đều optional nhưng phải gửi cùng nhau. Response:

```json
{
  "banners": [],
  "categories": [
    {
      "id": "category-uuid",
      "name": "Massage/Giãn cơ",
      "slug": "massage-gian-co",
      "iconUrl": null,
      "isActive": true,
      "sortOrder": 1,
      "createdAt": "2026-09-25T00:00:00.000Z",
      "updatedAt": "2026-09-25T00:00:00.000Z"
    }
  ],
  "technicians": []
}
```

`banners` chỉ chứa banner active trong thời gian hiệu lực. `categories` chỉ chứa category active. `technicians` tối đa 10 Technician Card.

## 5. Search, filter và sort KTV

```http
GET /api/marketplace/technicians
```

| Query                   | Kiểu/validation                                     | Ý nghĩa                                      |
| ----------------------- | --------------------------------------------------- | -------------------------------------------- |
| `search`                | string, tối đa 100                                  | Tìm display name, không phân biệt hoa thường |
| `keyword`               | string, tối đa 100                                  | Alias của search; `search` ưu tiên hơn       |
| `gender`                | `MALE`, `FEMALE`, `OTHER`                           | Filter giới tính                             |
| `tag`                   | string, tối đa 50                                   | Một tag                                      |
| `tags`                  | repeated/comma-separated, 1–20                      | Tất cả tag truyền vào phải khớp              |
| `categoryId`            | UUID                                                | ServiceCategory ID                           |
| `serviceId`             | UUID                                                | TechnicianService ID, không phải category ID |
| `mode`                  | `HOME`, `ONSITE`, `ONLINE`                          | Profile và service active phải hỗ trợ        |
| `available`             | `true`/ `false`                                     | Trạng thái sẵn sàng KTV khai báo             |
| `latitude`, `longitude` | number                                              | Gửi cùng nhau để tính/sort khoảng cách       |
| `sort`                  | `recommended`, `distance`, `rating`, `availability` | `distance` yêu cầu tọa độ                    |
| `page`                  | integer >= 1, default 1                             | Trang offset                                 |
| `limit`                 | integer 1–100, default 20                           | Số item                                      |

Ví dụ:

```http
GET /api/marketplace/technicians?search=Lan&gender=FEMALE&tags=massage,yoga&mode=HOME&available=true&sort=rating&page=1&limit=20
```

Có location, `recommended` ưu tiên gần nhất rồi available/rating. Không có location, `recommended` ưu tiên available rồi rating. Khoảng cách đơn vị km, làm tròn 0.1 và null nếu KTV không có tọa độ.

Response:

```json
{
  "items": [
    {
      "id": "technician-profile-uuid",
      "technicianId": "technician-profile-uuid",
      "userId": "user-uuid",
      "displayName": "Nguyễn Lan",
      "avatarUrl": "https://...",
      "averageRating": 4.5,
      "rating": 4.5,
      "reviewCount": 12,
      "gender": "FEMALE",
      "tags": ["massage"],
      "serviceModes": ["HOME", "ONSITE"],
      "supportedModes": ["HOME"],
      "isVerified": true,
      "isAvailable": true,
      "isFavorite": false,
      "city": "HCM",
      "startingPrice": 150000,
      "distanceKm": 2.3,
      "nextAvailableAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

`technicianId`/ `id` là **TechnicianProfile.id**. `userId` là ID account, không dùng thay technicianId khi detail, favorite, availability, quote hoặc booking. `averageRating` và `rating` là cùng giá trị. `serviceModes` là profile config; `supportedModes` là mode thực sự có service active phù hợp. `startingPrice` là giá active service thấp nhất phù hợp filter. `nextAvailableAt` hiện luôn null vì chưa có service/duration được chọn.

## 6. Guest và authenticated user

Guest nhận `isFavorite=false`. User đăng nhập nhận `isFavorite=true` chỉ khi current user có record favorite của KTV đó. Không hiển thị hoặc gửi favorite của user khác. Nếu Bearer token sai/hết hạn, API public cũng trả 401; muốn browse như guest thì bỏ Authorization.

## 7. Technician Detail

```http
GET /api/marketplace/technicians/:technicianId?latitude=10.7769&longitude=106.7009
```

Response giữ tất cả field Technician Card, thêm `bio`, `images`, `onsiteLocation`, `services`, `reviews`. `images` hiện là avatar-only fallback vì schema chưa có gallery.

```json
{
  "technicianId": "technician-profile-uuid",
  "displayName": "Nguyễn Lan",
  "isFavorite": true,
  "supportedModes": ["HOME", "ONSITE"],
  "services": [
    {
      "id": "technician-service-uuid",
      "serviceId": "technician-service-uuid",
      "technicianServiceId": "technician-service-uuid",
      "categoryId": "category-uuid",
      "categoryName": "Massage/Giãn cơ",
      "name": "Massage 60 phút",
      "description": null,
      "price": 150000,
      "durationMinutes": 60,
      "modes": ["HOME", "ONSITE"],
      "supportedModes": ["HOME", "ONSITE"],
      "isActive": true
    }
  ],
  "reviews": []
}
```

Chỉ service active thuộc category active được trả. Dùng `services[].technicianServiceId` khi Availability, Quote và Create Booking. Detail embed tối đa 20 review mới nhất; reviewer chỉ có id/displayName/avatarUrl.

## 8. Flow Mobile

1. Home: gọi `GET /marketplace/home`; guest được phép.
2. List/search: gọi `GET /marketplace/technicians` khi user đổi keyword/filter/page.
3. Detail: lấy `technicianId` từ card, không lấy `userId`.
4. User chọn service: lưu `technicianServiceId` và mode.
5. Gọi Availability rồi Quote/Create Booking.
6. Nếu login, dùng favorite APIs và refetch/update `isFavorite`.

## 9. Loading, empty và error state

- Loading: hiển thị skeleton card, chống request search cũ ghi đè kết quả mới.
- Empty: `items=[]` không phải lỗi; giữ filter để user đổi filter.
- Pagination: dùng `total`, `page`, `limit`; out-of-range có thể items rỗng nhưng total > 0.
- Error: giữ state filter; không fallback sang ID hoặc dữ liệu user khác.

## 10. Error Codes và xử lý

| HTTP | Message/code thực tế                            | Mobile xử lý                                       |
| ---- | ----------------------------------------------- | -------------------------------------------------- |
| 400  | `Can gui ca latitude va longitude`              | Gửi đủ cặp tọa độ hoặc bỏ cả hai.                  |
| 400  | `Toa do khong hop le`                           | Kiểm tra lat [-90,90], lng [-180,180].             |
| 400  | `Sap xep khoang cach can latitude va longitude` | Bỏ sort distance hoặc lấy location.                |
| 400  | validation UUID/mode/page/limit không hợp lệ    | Sửa query trước khi retry.                         |
| 401  | `Access token khong hop le hoac da het han`     | Refresh/login lại, hoặc bỏ token để browse guest.  |
| 404  | `Ky thuat vien khong ton tai`                   | Quay lại list và refetch; profile có thể đã bị ẩn. |

Chỉ KTV profile active, verified, linked user ACTIVE và có ít nhất một service active/category active mới xuất hiện public.

## 11. Những điều Mobile KHÔNG được làm

- Không dùng `userId` thay `technicianId`.
- Không tự tính giá, duration, distance hoặc availability.
- Không coi `isAvailable` là guarantee của slot.
- Không gửi `userId` trong query/body để yêu cầu isFavorite.
- Không dùng service inactive hoặc master service ID giả khi booking.
- Không yêu cầu login chỉ để browse Marketplace.
