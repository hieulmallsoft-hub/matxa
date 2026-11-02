# Quản lý Địa điểm & Spa

Admin đăng nhập có thể thêm, sửa, xóa, ẩn/hiển thị địa điểm và xem chi tiết.
Danh sách trống hoặc lỗi API không được thay bằng địa điểm mẫu.

## Dữ liệu và API

- `GET /api/admin/venues`: địa điểm còn tồn tại, gồm đang hiển thị và đã ẩn.
- `POST /api/admin/venues`: tạo địa điểm.
- `PATCH /api/admin/venues/{id}`: cập nhật một phần; danh sách `services` và
  `hours` được thay thế cùng bản ghi trong một thao tác atomic. Gửi `[]` để xóa
  hết danh sách đó; không gửi field để giữ nguyên.
- `DELETE /api/admin/venues/{id}`: xóa mềm bằng `deletedAt`, loại khỏi cả danh
  sách admin và public. Khác với `isActive: false`, chỉ ẩn khỏi app.
- `POST /api/admin/venues/images`: upload multipart field `file`, trả `{ url }`.
- `GET /api/venues` và `GET /api/venues/{id}` chỉ trả địa điểm đang hiển thị,
  chưa bị xóa. Query `category` lọc theo danh mục.

Danh mục: `MASSAGE_SPA`, `CONSULTATION`. Địa điểm cũ mặc định `MASSAGE_SPA`.
Danh mục `TRAINING` (Địa điểm đào tạo) đã bỏ: không tạo hay lọc được nữa, và migration
`20261102120000_venue_reviews_offers` ẩn các địa điểm đào tạo cũ (không xóa dữ liệu).
Khóa học trên app dùng mục Khóa học đào tạo, không phải địa điểm.

Thông tin thêm cho app (API mobile: [venues.md](../mobile/venues.md)):

- `phone`: số cho nút **Gọi**. Để trống thì app ẩn nút.
- `isVerified`: hiện dấu tích xanh cạnh tên.
- `promotionId`: gắn một mã khuyến mãi làm ưu đãi của địa điểm. App chỉ hiện ưu đãi khi
  mã đang bật và còn hạn; nhãn "-40%" lấy từ loại/giá trị mã. Các mục Thông tin,
  Điều khoản, Lưu ý trên màn ưu đãi nhập trong form tạo mã khuyến mãi.

## Đánh giá

Khách viết đánh giá 1–5 sao trên app, mỗi khách một đánh giá cho mỗi địa điểm.
`rating` và `reviewCount` của địa điểm được tính lại tự động mỗi khi có đánh giá mới
hoặc admin ẩn/hiện, không nhập tay.

- `GET /api/admin/venues/{id}/reviews`: tất cả đánh giá, kể cả đã ẩn, kèm tên thật.
- `PATCH /api/admin/venues/reviews/{reviewId}` với `{"isHidden": true}`: ẩn đánh giá
  spam/không phù hợp khỏi app và khỏi điểm trung bình. `false` để hiện lại.

Trên web: mở chi tiết địa điểm, mục **Đánh giá của khách**, bấm **Ẩn** / **Hiện lại**.

`services`: tên, thời lượng 1–1440 phút, giá nguyên VND >= 0.
`hours`: tối đa 7 ngày, không trùng `dayOfWeek`; 0 là Chủ nhật, 1–6 là Thứ Hai–Bảy.
Ngày mở cửa dùng `HH:mm` và đóng sau giờ mở trong cùng ngày. Ngày đóng cửa
trả `isClosed: true`, giờ mở/đóng là `null`.

Web có tìm kiếm tên/địa chỉ, lọc danh mục/thành phố/trạng thái và sắp xếp tên hoặc
đánh giá. Không tạo đánh giá, khoảng cách hay ưu đãi giả.

## Ảnh và vị trí

Ảnh JPEG/PNG/WebP tối đa 5 MB mỗi file, tối đa 10 ảnh mỗi địa điểm. Web upload
file riêng rồi gửi URL trong payload lưu, không gửi Base64. Upload yêu cầu:

```text
S3_BUCKET
S3_REGION
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_PUBLIC_BASE_URL   # URL CDN/public của bucket, nếu dùng
S3_ENDPOINT          # nếu dùng storage tương thích S3
```

Ảnh cần đọc được qua URL public/CDN đã cấu hình. Nếu S3 chưa cấu hình, admin vẫn
có thể lưu địa điểm bằng URL ảnh http/https (mỗi dòng một URL) hoặc chưa có ảnh.
Khi request lưu thất bại, form được giữ và lần thử lại tái sử dụng ảnh vừa upload.

Lấy vị trí tự động cần HTTPS hoặc localhost và quyền trình duyệt. Trên server
HTTP, nhập tọa độ từ bản đồ; tọa độ phải là vị trí địa điểm thực tế.

## Triển khai

Sau khi commit/push, vào thư mục dự án trên server. Backup database trước migration.

```bash
git pull --ff-only origin main
cd backend
npm ci
npm run build
npm run db:deploy
cd ../operations-web
npm ci
npm run build
pm2 restart TEN_BACKEND
pm2 logs TEN_BACKEND --lines 50
```

Thay `TEN_BACKEND` bằng tên trong `pm2 list`. Migration
`20261029140000_venue_management` thêm danh mục và `deleted_at`;
`20261102120000_venue_reviews_offers` thêm số điện thoại, xác minh, ưu đãi, bảng đánh giá
và các mục chữ của mã khuyến mãi. Không chạy seed
demo trên production. Tải lại `/admin/` bằng Ctrl+F5 sau khi triển khai.

## Kiểm tra

1. Tạo địa điểm với ít nhất một dịch vụ có giá/thời lượng và giờ mở cửa từng ngày.
2. Upload ảnh hoặc nhập URL; lưu rồi tải lại danh sách để đối chiếu dữ liệu.
3. Sửa tên, giá dịch vụ, lịch ngày Chủ nhật; lưu rồi mở chi tiết để kiểm tra.
4. Đổi danh mục và thử các bộ lọc. Ẩn địa điểm: admin vẫn thấy, public không thấy.
5. Hiển thị lại; kiểm tra public thấy lại đúng địa điểm.
6. Xóa rồi tải lại: không được hiện lại hay thay bằng địa điểm mẫu.
7. Khi API lỗi, phải hiện thông báo và giữ form để thử lại.
