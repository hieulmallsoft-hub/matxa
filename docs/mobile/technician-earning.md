# Thu nhập KTV

KTV chỉ hiển thị số backend trả về. Không tự tính từ `totalAmount`, giá dịch vụ hiện tại hoặc HOME fee.

`GET /api/technician/jobs` và `GET /api/technician/jobs/:id` trả thêm:

```json
{
  "pricing": {
    "grossServiceAmount": 500000,
    "platformFee": 0,
    "technicianEarning": 500000,
    "currency": "VND"
  }
}
```

- `grossServiceAmount`: tổng giá dịch vụ đã snapshot khi booking tạo.
- `platformFee`: khoản platform giữ lại theo policy snapshot.
- `technicianEarning`: thu nhập KTV snapshot, là nguồn cho payout/wallet phase sau.
- Booking legacy có thể trả các trường tiền `null`; mobile hiển thị trạng thái chưa có dữ liệu thay vì tự suy ra.

Hiện policy `ZERO_V1`: platform fee bằng 0. Discount/promotion và HOME fee không được tự trừ/cộng vào KTV earning cho tới khi có chính sách thương mại chính thức. Một booking đã tạo hoặc hoàn thành không bị repricing khi cấu hình/policy thay đổi.
