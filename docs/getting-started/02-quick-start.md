# ⚡ Quick Start - Start dalam 5 Menit

Panduan cepat untuk start backend dan frontend di localhost.

## 🎯 Dalam 5 Menit

### 1. Buka Terminal Pertama - Start Backend

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Output yang diharapkan:**
```
INFO:     Application startup complete
INFO:     Uvicorn running on http://0.0.0.0:8001
```

✅ **Backend berjalan di** `http://localhost:8001`

### 2. Buka Terminal Kedua - Start Frontend

```powershell
cd frontend
npm install
npm run web
```

**Output yang diharapkan:**
```
Local:          http://localhost:3000
To create a shareable link, run `npx expo-cli start --tunnel`
```

✅ **Frontend akan otomatis buka di** `http://localhost:3000`

---

## ✨ Selesai!

| Component | URL | Status |
|-----------|-----|--------|
| Frontend | http://localhost:3000 | ✅ Ready |
| Backend API | http://localhost:8001 | ✅ Ready |
| MongoDB | localhost:27017 | ✅ Ready |

---

## 🔗 API Testing

Test backend API dari terminal:

```powershell
# Health check
curl http://localhost:8001/api/health
```

---

## 📖 Butuh Info Lebih Lanjut?

- **Backend detail** → [Backend Setup](./03-backend-setup.md)
- **Frontend detail** → [Frontend Setup](./04-frontend-setup.md)
- **Ada error?** → [Troubleshooting](./05-troubleshooting.md)

---

## 💡 Tips

- Jangan tutup terminal - biarkan server terus jalan
- Frontend auto-reload saat ada perubahan file
- Backend auto-reload saat ada perubahan code
- Tekan `Ctrl+C` untuk stop server
