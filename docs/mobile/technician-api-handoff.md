# Technician API Handoff – Mobile

Base URL production:

```text
https://<api-domain>/api
```

Local:

```text
http://localhost:3000/api
```

All protected APIs require:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## 1. Registration flow

```text
Login
  -> POST /technician/application
  -> PATCH /technician/application
  -> upload avatar/gallery if needed
  -> request 3 private upload URLs
  -> PUT files to S3 using each uploadUrl
  -> PATCH application with the 3 mediaKey values
  -> POST /technician/application/submit
  -> poll GET /technician/application
  -> if APPROVED: manage services, prices and availability
```

The user remains `CUSTOMER` until Admin approves the application. Mobile must not change the role locally.

## 2. Application APIs

### Create draft

```http
POST /technician/application
```

Body:

```json
{}
```

### Get current application

```http
GET /technician/application
```

Important response fields:

```json
{
  "id": "uuid",
  "status": "DRAFT",
  "displayName": "Nguyễn Văn An",
  "gender": "MALE",
  "city": "HN",
  "district": "HN-CAU-GIAY",
  "supportedModes": ["HOME", "ONSITE"],
  "bio": "...",
  "rejectionReason": null,
  "kyc": { "status": "NOT_STARTED" }
}
```

### Update draft

```http
PATCH /technician/application
```

Body:

```json
{
  "applicationType": "MASSAGE",
  "displayName": "Nguyễn Văn An",
  "gender": "MALE",
  "city": "HN",
  "district": "HN-CAU-GIAY",
  "supportedModes": ["HOME", "ONSITE"],
  "facility": "Có phòng riêng",
  "bio": "Có 5 năm kinh nghiệm massage trị liệu",
  "idCardFrontKey": "technician-applications/<userId>/id_card_front/<file>.jpg",
  "idCardBackKey": "technician-applications/<userId>/id_card_back/<file>.jpg",
  "faceImageKey": "technician-applications/<userId>/face/<file>.jpg"
}
```

Valid `supportedModes`: `HOME`, `ONSITE`, `ONLINE`.

Location codes must be used, not display names. Examples: `HN`, `HCM`, `DN`, `HN-BA-DINH`, `HN-CAU-GIAY`, `HCM-Q1`, `DN-HAI-CHAU`.

### Submit for review

```http
POST /technician/application/submit
```

Body:

```json
{}
```

Required before submit: `displayName`, valid `city`/`district`, `idCardFrontKey`, `idCardBackKey`, and `faceImageKey`.

## 3. Private KYC upload

Request one URL for each document:

```http
POST /technician/application/document-upload-url
```

Request examples:

```json
{
  "documentType": "ID_CARD_FRONT",
  "contentType": "image/jpeg",
  "size": 250000
}
```

Allowed `documentType`: `ID_CARD_FRONT`, `ID_CARD_BACK`, `FACE`.

Response:

```json
{
  "uploadUrl": "https://signed-s3-url",
  "mediaKey": "technician-applications/<userId>/id_card_front/<uuid>.jpg",
  "expiresIn": 300
}
```

Upload the binary file directly to S3:

```http
PUT <uploadUrl>
Content-Type: image/jpeg
```

Then send the returned `mediaKey` in the application PATCH. Never send a public URL and never reuse the JSON key `mediaKey` three times; use `idCardFrontKey`, `idCardBackKey`, and `faceImageKey`.

## 4. Application states

| State | Mobile behavior |
|---|---|
| `DRAFT` | Editable; show Continue/Submit |
| `SUBMITTED` | Read-only; waiting for Admin |
| `UNDER_REVIEW` | Read-only; Admin is reviewing |
| `APPROVED` | Enable technician services and availability |
| `REJECTED` | Show `rejectionReason`; allow edit and resubmit |

KYC states: `NOT_STARTED`, `ID_UPLOADED`, `FACE_UPLOADED`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`.

## 5. Technician profile

```http
GET   /technician/profile
PATCH /technician/profile
```

Profile fields include avatar, gallery, display name, gender, city, district, supported modes, bio and facility. Avatar upload uses:

```http
POST /profile/avatar-upload-url
```

Gallery uses:

```http
POST   /technician/application/gallery-upload-url
POST   /technician/application/gallery
DELETE /technician/application/gallery/{id}
```

## 6. Services and prices

```http
POST   /technician/services
PATCH  /technician/services/{id}
GET    /technician/services/{id}/price-options
POST   /technician/services/{id}/price-options
PATCH  /technician/services/{id}/price-options/{optionId}
DELETE /technician/services/{id}/price-options/{optionId}
```

Create service example:

```json
{
  "categoryId": "uuid",
  "name": "Massage chân",
  "modes": ["HOME"],
  "priceOptions": [
    { "code": "60_MINUTES", "durationMinutes": 60, "price": 500000 },
    { "code": "90_MINUTES", "durationMinutes": 90, "price": 600000 },
    { "code": "120_MINUTES", "durationMinutes": 120, "price": 700000 }
  ]
}
```

Do not assume one service has only one price. Category templates may use 60/90/120 minutes, 2/4/6 hours, or another duration rule.

## 7. Availability

```http
POST   /technician/availability
DELETE /technician/availability/{id}
```

Create example:

```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "18:00",
  "timezone": "Asia/Ho_Chi_Minh"
}
```

## 8. Jobs: apply and receive orders in Mobile

```http
GET  /technician/jobs?status=AVAILABLE
GET  /technician/jobs/{id}
POST /technician/jobs/{id}/accept
POST /technician/jobs/{id}/decline
POST /technician/jobs/{id}/complete
GET  /technician/jobs/{id}/contact
```

The job detail contains customer, address, scheduled time, mode, services, duration and payout. Accept/decline/complete requests have an empty body unless Swagger specifies otherwise.

## 9. Notifications

```http
GET   /notifications
PATCH /notifications/{id}/read
PATCH /notifications/read-all
DELETE /notifications/{id}
```

After Admin approves or rejects an application, Mobile reads the result from the application API and notification API.

## 10. Error handling

```json
{
  "statusCode": 400,
  "message": "Quan/huyen khong thuoc thanh pho da chon",
  "error": "Bad Request"
}
```

Common statuses: `400` validation, `401` expired/invalid token, `403` wrong role, `404` resource not found, `409` duplicate/conflicting action, `500` server error.

KYC keys and images are private. Never expose CCCD or face images in Marketplace/public technician detail responses.
