# Dinh huong kien truc

Tai lieu nay se ghi lai cac quyet dinh ve framework, co so du lieu, xac thuc, luu tru tep, thong bao va trien khai.

## Nguyen tac ban dau

- Chia theo module nghiep vu.
- Tach cau hinh khoi ma nguon.
- Khong commit bi mat vao Git.
- API phai co validation, tai lieu va kiem thu.

## Phone OTP

- NestJS dieu phoi quy trinh OTP; SMS duoc gui qua interface `SmsProvider`.
- Redis luu challenge co TTL, cooldown va bo dem rate limit.
- Redis key khong chua so dien thoai/IP/device ID dang ro; cac gia tri nay duoc HMAC.
- OTP chi luu dang HMAC, gom 6 chu so, het han sau 5 phut va chi dung mot lan.
- Production khong cho phep `DevelopmentSmsProvider`.
