# Chat trên web quản trị

Vào **Tin nhắn CSKH → Tạo cuộc trò chuyện**, tìm khách theo tên, số điện thoại,
email hoặc ID user rồi chọn khách. Không cần có booking. Web gọi
`POST /api/conversations/support` với body `{"customerId":"UUID user khách"}`.
Mỗi khách có một hội thoại `SUPPORT`; chọn lại khách sẽ mở lịch sử cũ.
Các admin cùng xử lý được, từng tin vẫn lưu rõ admin nào gửi.

Hộp thư dùng `GET /api/conversations?type=SUPPORT`. Chat booking khách–KTV
được giữ riêng. Xem [API mobile hỗ trợ](../mobile/support-chat.md).

- Web xác minh tài khoản qua `/api/auth/me`, không dùng hội thoại mẫu khi API lỗi.
- Danh sách tự cập nhật mỗi 5 giây, tin nhắn hội thoại đang mở mỗi 3 giây.
- Gửi text qua `POST /api/conversations/{id}/messages`; gửi lỗi giữ nội dung để thử lại.
- Chỉ tin nhắn có `senderId` trùng tài khoản admin hiện tại mới nằm phía gửi của mình.
- Tin nhắn hệ thống, ảnh và tin đã thu hồi được hiển thị theo dữ liệu API.
- Gửi ảnh qua nút đính kèm; xem tin cũ hơn 100 tin qua nút tải lịch sử.
- Tin REST từ web được phát qua Socket.IO `message.created` để mobile nhận ngay.
- Admin đọc dùng `ConversationMember.lastReadAt` riêng, không đánh dấu khách/KTV đã đọc.
- Chỉ chính khách và admin được vào hội thoại hỗ trợ; KTV và khách khác bị từ chối.
- Lịch sử lưu tại `conversations`, `conversation_members`, `messages` trên database
  server; ảnh lưu trên S3. Không tự xóa lịch sử khi đăng xuất hoặc đóng app.

## Triển khai

Sau khi commit và push các thay đổi, vào thư mục dự án trên server:

```bash
git pull --ff-only origin main
cd operations-web
npm ci
npm run build
cd ../backend
npm ci
npm run db:deploy
npm run db:generate
npm run build
pm2 restart TEN_BACKEND
pm2 logs TEN_BACKEND --lines 50
```

Thay `TEN_BACKEND` bằng tên backend trong `pm2 list`. Backup database trước migration.
Migration `20261102080000_support_conversations` thêm loại hội thoại và khóa duy nhất
theo khách; giữ dữ liệu chat cũ. Cần migrate trước khi restart backend mới.

Backend phục vụ `operations-web/dist` ở `/admin/`. Nếu vẫn thấy các tên khách mẫu
như “Nguyễn Thị Lan Anh”, kiểm tra đã build đúng thư mục web mà backend phục vụ
và tải lại trình duyệt bằng Ctrl+F5.

## Kiểm tra sau triển khai

1. Đăng nhập bằng tài khoản admin thật và mở “Tin nhắn CSKH”.
2. Admin chọn khách chưa có booking và gửi lời chào cùng một ảnh.
3. Khách lấy `GET /api/conversations?type=SUPPORT`, mở đúng ID và trả lời; web nhận tin.
4. Gửi tin mới từ app; admin nhận được trong khoảng 3 giây khi hội thoại đang mở.
5. Đổi hội thoại trong lúc gửi; phản hồi gửi thành công không được xuất hiện ở hội thoại khác.
6. Nếu lỗi đăng nhập/API, web phải hiện lỗi và không thay bằng hội thoại giả.
7. Admin chọn lại cùng khách: ID hội thoại giữ nguyên và còn lịch sử. Admin khác cũng xem được.
8. Token khách khác hoặc KTV gọi ID hỗ trợ này: nhận `403`.
9. Mobile đang nghe socket phải nhận `message.created` khi admin gửi từ web.
