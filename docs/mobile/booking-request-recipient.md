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

`isApplicant = true` khi KTV đang ứng tuyển (`APPLIED`); `isSelected = true`
khi KTV đã được chốt cuối cùng (`SELECTED`). Hai trạng thái này độc lập với
`isRequestedTechnician`: khách có thể yêu cầu Đức ban đầu nhưng chốt FFtools.

Mobile dùng `requestType` để chọn kiểu thẻ (cam cho `CUSTOMER_REQUEST`, xanh
cho `MARKETPLACE`) và `requestLabel` để hiển thị nhãn. Không suy luận người
được khách yêu cầu từ `applicationStatus` hay `technicianId` được gán cuối cùng.
Trạng thái `SELECTED` vẫn có nghĩa khách đã chọn ứng viên để thực hiện dịch vụ.

Nút ứng tuyển tiếp tục dựa vào `canApply`; từ chối dựa vào `canDecline`.
Trong luồng OPEN, chỉ KTV khách yêu cầu ban đầu có `canDecline = true` khi còn được ứng tuyển.
Metadata này không cấp thêm quyền nhận đơn, xem liên hệ hay bỏ qua bước khách chọn.
## Thông báo

Khi đơn mở được tạo, mỗi KTV phù hợp nhận một thông báo trong app và một push.
Loại thông báo khác nhau theo người nhận:

| Người nhận | `type` | Tiêu đề mặc định | Nội dung mặc định |
| --- | --- | --- | --- |
| KTV khách chọn | `OPEN_BOOKING_REQUESTED` | Khách đặt bạn | Khách hàng đã chọn bạn cho đơn dịch vụ mới. Hãy mở đơn để ứng tuyển hoặc từ chối. |
| KTV phù hợp khác | `OPEN_BOOKING_AVAILABLE` | Yêu cầu mới | Có đơn dịch vụ mới phù hợp. Hãy mở tab Nhận việc để xem và ứng tuyển. |

Push data có thêm `requestType` và `requestLabel` (cùng giá trị như bảng trên):

```json
{ "type": "OPEN_BOOKING_REQUESTED", "bookingId": "booking-id",
  "requestType": "CUSTOMER_REQUEST", "requestLabel": "Khách đặt bạn" }
```

Trong danh sách `GET /api/notifications`, phân biệt bằng `type` (thông báo trong app
không có trường data). Cả hai loại có `actionUrl = matxa://bookings/{bookingId}`;
chạm vào thì mở chi tiết đơn `GET /api/technician/jobs/{bookingId}`.
Mobile phải xử lý `OPEN_BOOKING_REQUESTED` giống `OPEN_BOOKING_AVAILABLE`
(mở chi tiết đơn), chỉ khác kiểu hiển thị.

Tiêu đề và nội dung có thể bị admin đổi trong Cấu hình → mẫu thông báo, nên
mobile không so khớp theo chữ mà dùng `type` hoặc `requestType`.

Đơn mở tạo không có KTV yêu cầu trả `requestedTechnicianId: null`, nhãn
“Yêu cầu mới”. Dữ liệu đơn mở cũ đã mất lựa chọn ban đầu không được suy đoán
hay khôi phục từ KTV được gán sau đó. Migration chỉ backfill các đơn `DIRECT`
có KTV rõ ràng. Khi đơn `DIRECT` chuyển sang marketplace, lựa chọn ban đầu được giữ lại.

Triển khai backend: chạy `npm run db:deploy`, `npm run db:generate` và build
lại backend. Repo này không chứa app mobile; mobile cần dùng các field trên để render.

Xem [luồng đặt lịch và ứng tuyển](booking-technician-matching.md) để tích hợp toàn bộ quy trình.
