# Tìm KTV theo thời gian và vị trí

Mobile gọi:

```http
GET /api/marketplace/technicians?mode=HOME&availableFrom=2026-10-15T14:00:00%2B07:00&availableTo=2026-10-15T15:00:00%2B07:00&latitude=21.0285&longitude=105.8542&radiusKm=25
```

Khi có `availableFrom` và `availableTo`, backend chỉ trả KTV:

- đã active, verified và có dịch vụ phù hợp;
- có `AvailabilitySlot` bao phủ toàn bộ khoảng thời gian;
- không có booking `PENDING` hoặc `CONFIRMED` bị trùng giờ;
- nằm trong bán kính `radiusKm` tính từ tọa độ địa chỉ khách.

`latitude`, `longitude`, `availableFrom`, `availableTo` phải gửi theo cặp. `radiusKm` mặc định không bắt buộc; nếu không gửi thì không giới hạn bán kính.

## Realtime

Kết nối Socket.IO tới namespace `/marketplace` bằng access token:

```ts
const socket = io(`${API_URL}/marketplace`, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
socket.emit('matching.subscribe');
socket.on('matching.updated', ({ technicianId }) => {
  // Gọi lại GET /api/marketplace/technicians với bộ lọc hiện tại.
});
```

Sự kiện được phát khi KTV tạo hoặc xóa khung giờ. Mobile luôn gọi lại API để lấy dữ liệu chính xác; socket chỉ là tín hiệu cập nhật, không thay thế bộ lọc backend.
