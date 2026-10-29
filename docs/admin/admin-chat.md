# Chat trên web quản trị

Trang “Tin nhắn CSKH” dùng các hội thoại thật từ `GET /api/conversations`.
Admin đăng nhập có thể đọc và trả lời trong hội thoại đặt lịch giữa khách và KTV.
Đây là hộp thư hỗ trợ trên hội thoại đặt lịch hiện có; chưa tạo hội thoại CSKH
độc lập trước khi có booking.

- Web xác minh tài khoản qua `/api/auth/me`, không dùng hội thoại mẫu khi API lỗi.
- Danh sách tự cập nhật mỗi 5 giây, tin nhắn hội thoại đang mở mỗi 3 giây.
- Gửi text qua `POST /api/conversations/{id}/messages`; gửi lỗi giữ nội dung để thử lại.
- Chỉ tin nhắn có `senderId` trùng tài khoản admin hiện tại mới nằm phía gửi của mình.
- Tin nhắn hệ thống, ảnh và tin đã thu hồi được hiển thị theo dữ liệu API.
- Admin đọc dùng `ConversationMember.lastReadAt` riêng, không đánh dấu khách/KTV đã đọc.
- Admin có bản ghi membership vẫn được hỗ trợ hội thoại đặt lịch; thành viên thường
  tiếp tục phải là khách hoặc KTV đang được gán đơn.

## Triển khai

Sau khi commit và push các thay đổi, vào thư mục dự án trên server:

```bash
git pull --ff-only origin main
cd operations-web
npm ci
npm run build
cd ../backend
npm ci
npm run build
pm2 restart TEN_BACKEND
pm2 logs TEN_BACKEND --lines 50
```

Thay `TEN_BACKEND` bằng tên backend trong `pm2 list`. Bản sửa chat không thêm
migration. Nếu triển khai cùng bản phân biệt KTV trước đó, chạy
`npm run db:deploy` trong `backend` trước khi restart.

Backend phục vụ `operations-web/dist` ở `/admin/`. Nếu vẫn thấy các tên khách mẫu
như “Nguyễn Thị Lan Anh”, kiểm tra đã build đúng thư mục web mà backend phục vụ
và tải lại trình duyệt bằng Ctrl+F5.

## Kiểm tra sau triển khai

1. Đăng nhập bằng tài khoản admin thật và mở “Tin nhắn CSKH”.
2. Khách/KTV mở chat từ booking đã được gán KTV và gửi tin trên app.
3. Hội thoại xuất hiện trong admin; mở và gửi trả lời. App nhận tin trong cùng hội thoại.
4. Gửi tin mới từ app; admin nhận được trong khoảng 3 giây khi hội thoại đang mở.
5. Đổi hội thoại trong lúc gửi; phản hồi gửi thành công không được xuất hiện ở hội thoại khác.
6. Nếu lỗi đăng nhập/API, web phải hiện lỗi và không thay bằng hội thoại giả.
