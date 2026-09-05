# Matxa Backend

Backend NestJS + TypeScript cho ung dung Matxa, duoc to chuc theo tung module MVC.

## Cau truc

```text
src/
|-- common/               Thanh phan dung chung
|-- config/               Cau hinh ung dung
|-- database/             PostgreSQL qua Prisma
|-- redis/                Ket noi Redis
|-- modules/
|   |-- auth/             OTP, SMS, Google va session
|   `-- health/           Kiem tra trang thai API
|-- app.module.ts         Module goc
`-- main.ts               Diem khoi dong ung dung
```

## Chay du an

```bash
npm install
docker compose up -d
npm run db:deploy
npm run start:dev
```

Kiem tra API tai `GET http://localhost:3000/api/health`.

Swagger UI: `http://localhost:3000/api/docs`.

## Dang nhap bang so dien thoai

NestJS tao OTP, chi luu HMAC cua OTP trong Redis va goi `SmsProvider`. Gui ma:

```http
POST /api/auth/phone/send-otp
```

```json
{
  "phoneNumber": "+84394338212",
  "deviceId": "android-installation-id"
}
```

Xac minh ma:

```http
POST /api/auth/phone/verify-otp
```

```json
{
  "challengeId": "UUID_TRA_VE_TU_SEND_OTP",
  "code": "123456",
  "deviceId": "android-installation-id"
}
```

Trong development, response `send-otp` co `debugOtp` de test ma khong ton SMS.
Che do nay bi chan khi `NODE_ENV=production`. Truoc khi production, can cai mot
implementation `SmsProvider` that va dat `SMS_PROVIDER` theo provider do.

Google dung Credential Manager tren Android de lay Google ID token va gui thang
den `POST /api/auth/google`. Backend xac minh token bang Google Auth Library voi
`GOOGLE_CLIENT_ID`; khong dung Firebase trong luong Google Login. Lan dau backend
tu tao user, cac lan sau dang nhap vao user co cung Google subject (`sub`).

Khi dung Firebase Phone Auth tren Android, client xac minh OTP voi Firebase, lay
Firebase ID token roi gui den:

```http
POST /api/auth/phone/firebase
```

```json
{
  "idToken": "FIREBASE_ID_TOKEN",
  "deviceId": "android-installation-id"
}
```

Backend chi chap nhan token co `firebase.sign_in_provider` la `phone` va co
`phone_number` da duoc Firebase xac minh. Hai endpoint OTP Redis van duoc giu lai
de co the ket noi nha cung cap SMS rieng sau nay.

Access token mac dinh het han sau 15 phut. Refresh token mac dinh ton tai 30 ngay,
chi duoc luu dang hash va duoc xoay vong sau moi lan refresh.

### API auth

- `POST /api/auth/phone/send-otp`: tao va gui OTP.
- `POST /api/auth/phone/verify-otp`: xac minh OTP va tao session.
- `POST /api/auth/phone/firebase`: dang nhap bang Firebase Phone ID token.
- `POST /api/auth/phone/link/send-otp`: gui OTP lien ket so, can Bearer token.
- `POST /api/auth/phone/link/verify-otp`: xac minh va lien ket so vao user hien tai.
- `POST /api/auth/google`: dang nhap bang Firebase Google.
- `POST /api/auth/refresh`: doi refresh token lay cap token moi.
- `GET /api/auth/me`: lay tai khoan hien tai, can Bearer access token.
- `POST /api/auth/logout`: thu hoi session hien tai.
- `POST /api/auth/logout-all`: thu hoi tat ca session cua user.
