# Matxa Backend

Backend NestJS + TypeScript cho ung dung Matxa, duoc to chuc theo tung module MVC.

## Cau truc

```text
src/
|-- common/               Thanh phan dung chung
|-- config/               Cau hinh ung dung
|-- database/             Migration va seed
|-- modules/
|   `-- health/
|       |-- controllers/  Controller nhan HTTP request
|       |-- models/       Model bieu dien du lieu
|       `-- services/     Service xu ly nghiep vu
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

## Dang nhap

Firebase Authentication thuc hien dang nhap tren client. Sau khi client nhan duoc
Firebase ID token, gui token den mot trong hai endpoint:

- `POST /api/auth/phone`
- `POST /api/auth/google`

Body:

```json
{
  "idToken": "FIREBASE_ID_TOKEN"
}
```

Backend xac minh token va dung provider, tao/cap nhat user trong PostgreSQL, sau
do tra ve `accessToken` va `refreshToken` cua Matxa. Truoc khi chay, sao chep
`.env.example` thanh `.env` va dien service account Firebase, `JWT_SECRET` va
`REFRESH_TOKEN_PEPPER`.

Access token mac dinh het han sau 15 phut. Refresh token mac dinh ton tai 30 ngay,
chi duoc luu dang hash va duoc xoay vong sau moi lan refresh.

### API auth

- `POST /api/auth/phone`: dang nhap bang Firebase Phone.
- `POST /api/auth/google`: dang nhap bang Firebase Google.
- `POST /api/auth/refresh`: doi refresh token lay cap token moi.
- `GET /api/auth/me`: lay tai khoan hien tai, can Bearer access token.
- `POST /api/auth/logout`: thu hoi session hien tai.
- `POST /api/auth/logout-all`: thu hoi tat ca session cua user.
