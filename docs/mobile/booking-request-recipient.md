# Phân biệt “Khách đặt bạn” và “Yêu cầu mới”

Khi khách chọn KTV ở bước matching rồi gọi `POST /api/bookings` với
`technicianId`, backend lưu lựa chọn vào `requestedTechnicianId`. Đơn vẫn là
`OPEN_MARKETPLACE`, được hiển thị cho KTV này và các KTV phù hợp khác để ứng tuyển.
`technicianId` của booking chỉ là KTV được gán cuối cùng sau khi khách chọn ứng viên.

`GET /api/technician/jobs` và `GET /api/technician/jobs/{id}` trả metadata
theo token KTV đang xem, dùng cho cả thẻ danh sách và màn chi tiết:

| Field | KTV khách yêu cầu ban đầu | KTV phù hợp khác |
| --- | --- | --- |
| `requestedTechnicianId` | ID profile KTV khách yêu cầu | Cùng ID profile đó |
| `isRequestedTechnician` | `true` | `false` |
| `requestType` | `CUSTOMER_REQUEST` | `MARKETPLACE` |
| `requestLabel` | `Khách đặt bạn` | `Yêu cầu mới` |

Mobile dùng `requestType` để chọn kiểu thẻ (cam cho `CUSTOMER_REQUEST`, xanh
cho `MARKETPLACE`) và `requestLabel` để hiển thị nhãn. Không suy luận người
được khách yêu cầu từ `applicationStatus` hay `technicianId` được gán cuối cùng.
Trạng thái `SELECTED` vẫn có nghĩa khách đã chọn ứng viên để thực hiện dịch vụ.

Nút ứng tuyển tiếp tục dựa vào `canApply`; từ chối dựa vào `canDecline`.
Metadata này không cấp thêm quyền nhận đơn, xem liên hệ hay bỏ qua bước khách chọn.
Notification vẫn dùng `OPEN_BOOKING_AVAILABLE`; khi mở thông báo, mobile tải chi
tiết đơn để lấy nhãn theo KTV đang xem.

Đơn mở tạo không có KTV yêu cầu trả `requestedTechnicianId: null`, nhãn
“Yêu cầu mới”. Dữ liệu đơn mở cũ đã mất lựa chọn ban đầu không được suy đoán
hay khôi phục từ KTV được gán sau đó. Migration chỉ backfill các đơn `DIRECT`
có KTV rõ ràng. Khi đơn `DIRECT` chuyển sang marketplace, lựa chọn ban đầu được giữ lại.

Triển khai backend: chạy `npm run db:deploy`, `npm run db:generate` và build
lại backend. Repo này không chứa app mobile; mobile cần dùng các field trên để render.

Tài liệu này cập nhật cách phân biệt người nhận theo luồng marketplace hiện tại;
phần mô tả tạo đơn `PENDING` trực tiếp trong `booking-technician-matching.md`
không phản ánh luồng hiện tại.
