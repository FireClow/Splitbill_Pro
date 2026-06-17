# SplitBill Frontend (Expo) - Local Development

Panduan ini untuk menjalankan aplikasi secara lokal agar bisa pantau perubahan real-time.

## Prasyarat

- Node.js 18+
- Python 3.11+
- MongoDB lokal aktif di `localhost:27017`

## Konfigurasi Environment

File ini sudah disiapkan:

- `frontend/.env`

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

Backend menggunakan:

- `backend/.env`

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=splitbill_local
```

## Jalankan Backend (Terminal 1)

Masuk ke folder `backend`, lalu jalankan:

```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Validasi cepat:

```bash
curl http://localhost:8000/api/health
```

## Jalankan Frontend Web (Terminal 2)

Masuk ke folder `frontend`, lalu jalankan:

```bash
npm install
npm run web
```

Expo akan membuka web lokal (umumnya `http://localhost:8081` atau port yang ditampilkan di terminal).

## Monitoring Perubahan

- Ubah file di `frontend/app/**` atau `backend/server.py`
- Frontend auto-refresh (HMR)
- Backend auto-reload karena `--reload`

## Catatan Akses dari HP (opsional)

Jika buka dari device lain, ganti `EXPO_PUBLIC_BACKEND_URL` ke IP LAN laptop, contoh:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.10:8000
```

## Release Android (safe)

Sebelum build/submission produksi, pastikan environment variable ini sudah terisi dengan URL publik HTTPS:

- `EXPO_PUBLIC_BACKEND_URL`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`
- `EXPO_PUBLIC_TERMS_URL`

Jalankan command aman berikut agar proses gagal otomatis jika env belum valid:

```bash
npm run build:android:safe
npm run submit:android:safe
```
