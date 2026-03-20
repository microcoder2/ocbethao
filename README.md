# Oc Be Thao

Workspace moi cho bai toan F&B, tach rieng:

- `api/`: Express + TSOA + Prisma + MySQL
- `frontend/`: Vue 3 + Vite + Bootstrap

## Tinh nang skeleton

- Login theo role `ADMIN / STAFF / CUSTOMER`
- Dang ky customer qua `PHONE / EMAIL / ZALO / APPLE`
- Quan ly danh muc mon, gia, hinh anh
- Tao thuc don ngay va publish
- Khach order mon va theo doi don cua minh
- Staff tao don tai ban, cap nhat trang thai don
- Admin xem doanh thu ngay/thang/nam, loai khach, order board

## Lenh chay

### Root workspace

Dung ngay tai thu muc `ocbethao/`:

```bash
npm install
npm run dev
```

Mac dinh dev server se bind ra LAN:

- Frontend: `0.0.0.0:5174`
- API: `0.0.0.0:3000`

Mo tren dien thoai cung Wi-Fi:

```text
http://192.168.1.27:5174
```

Frontend se tu goi API ve:

```text
http://192.168.1.27:3000
```

Neu IP LAN thay doi, frontend van tu suy ra API theo host hien tai neu khong set `VITE_API_BASE_URL`.

Lenh root khac:

```bash
npm run build
npm run db:push
npm run seed
```

## Cau hinh auth provider

Provider nao hien tren login page se do backend tra ve qua `/api/auth/providers`.
Nguon cau hinh tot nhat la `api/.env`, khong nen hardcode trong frontend.

```env
AUTH_ENABLED_LOGIN_PROVIDERS="password,google"
AUTH_ENABLED_LINK_PROVIDERS="google"
GOOGLE_CLIENT_ID="your-google-web-client-id.apps.googleusercontent.com"
GOOGLE_ALLOWED_HOSTED_DOMAIN=""
```

Google login hien tai dung Google Identity Services button + backend verify ID token.
Neu chay tren web client moi, nho them dung origin vao Google Cloud Console, vi du:

- `http://localhost:5174`
- `http://127.0.0.1:5174`
- `http://192.168.1.27:5174`

### API

1. Copy `api/.env.example` thanh `.env` hoac `.env.development`
2. Cai DB MySQL va tao database `ocbethao`
3. Chay:

```bash
cd api
npm install
npm run prisma:generate
npx prisma db push
npm run prisma:seed
npm run dev
```

### Frontend

1. Copy `frontend/.env.example` thanh `.env`
2. Chay:

```bash
cd frontend
npm install
npm run dev
```

## Tai khoan seed mac dinh

- Admin: `admin@ocbethao.local` / `123456`
- Staff: `staff@ocbethao.local` / `123456`
- Customer: `0909000003` / `123456`

## File schema

- Prisma schema: `api/prisma/schema.prisma`
- MySQL script: `api/prisma/schema.mysql.sql`
- Seeder: `api/prisma/seed.ts`
