# 🔧 Troubleshooting - Solusi Masalah Umum

Panduan untuk mengatasi masalah yang sering terjadi.

## 🚨 Backend Issues

### ❌ "ModuleNotFoundError: No module named 'fastapi'"

**Solusi:**
```powershell
cd backend
pip install -r requirements.txt
```

Memastikan Anda di folder `backend` dan pip install dependencies.

---

### ❌ "Port 8001 already in use"

**Solusi:**
```powershell
# Cari process yang menggunakan port 8001
netstat -ano | findstr :8001

# Kill process (ganti <PID> dengan nomor dari hasil di atas)
taskkill /PID <PID> /F

# Atau gunakan port lain
python -m uvicorn server:app --port 8002
```

---

### ❌ "MongoDB connection refused"

**Cek apakah MongoDB running:**
```powershell
Get-Process mongod -ErrorAction SilentlyContinue
```

**Jika tidak ada output:**
1. Buka Windows Services (Win+R → services.msc)
2. Cari "MongoDB Server"
3. Klik kanan → Start

**Jika tidak ada service:**
1. Download & install MongoDB dari [mongodb.com](https://www.mongodb.com/try/download/community)
2. Pilih "Install MongoDB as a Service"

---

### ❌ "SSL: CERTIFICATE_VERIFY_FAILED"

Masalah Python SSL di Windows.

**Solusi 1: Run SSL Fix Script**
```powershell
# Jalankan script yang sudah ada
.\fix-python-ssl.ps1
```

**Solusi 2: Manual**
```powershell
# Cari folder Python
python -c "import sys; print(sys.prefix)"

# Download certificate bundle
pip install certifi

# Set environment variable
$env:PYTHONPATH = "C:\Python39\Lib\site-packages"
```

---

### ❌ "uvicorn command not found"

```powershell
# Install uvicorn
pip install uvicorn

# Atau gunakan module syntax
python -m uvicorn server:app --port 8001
```

---

## 🎨 Frontend Issues

### ❌ "npm: command not found"

**Solusi:**
1. Install Node.js dari [nodejs.org](https://nodejs.org)
2. Restart terminal setelah install
3. Verifikasi: `node --version` dan `npm --version`

---

### ❌ "Port 3000 already in use"

```powershell
# Cari process di port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F

# Atau Expo akan ask, pilih 'Y' untuk gunakan port lain
```

---

### ❌ "Cannot find module '@react-navigation/native'"

```powershell
cd frontend
npm install

# Atau jika ada cached issue
rm -r node_modules package-lock.json
npm install
```

---

### ❌ "EXPO_PUBLIC variables not working"

Pastikan file `.env` ada di folder `frontend/`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

Kemudian restart Expo server:
```powershell
Ctrl+C untuk stop
npm run web
```

---

## 🌐 Connection Issues

### ❌ "Frontend tidak bisa connect ke backend"

**Cek backend running:**
```powershell
curl http://localhost:8001/api/health
```

Jika error, backend tidak running.

**Cek API URL di `.env`:**
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

**Untuk mobile device (tidak localhost):**
```env
# Ganti dengan IP address komputer
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8001
```

Cari IP dengan:
```powershell
ipconfig
# Cari IPv4 Address
```

---

## 📦 Dependency Issues

### ❌ "Version conflict" atau "peer dependency"

```powershell
# Frontend
npm install --legacy-peer-deps

# Backend
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

---

### ❌ "npm ERR! code ERESOLVE"

```powershell
cd frontend

# Option 1
npm install --legacy-peer-deps

# Option 2
npm install --force

# Option 3 - Reset semua
rm -r node_modules package-lock.json
npm cache clean --force
npm install
```

---

## 🗄️ Database Issues

### ❌ "Duplicate key error"

```powershell
# Connect ke MongoDB dan clear collections
mongosh

# Di mongosh console
use splitbill
db.collection_name.deleteMany({})
```

---

### ❌ "MongoDB service not starting"

```powershell
# Check status
Get-Service MongoDB | Select-Object Status

# Restart service
Restart-Service MongoDB

# Start if stopped
Start-Service MongoDB
```

**Jika masih error:**
1. Buka Services (Win+R → services.msc)
2. Cari MongoDB Server
3. Klik kanan → Properties
4. Check startup type

---

## 🐛 Debugging Tips

### Enable More Verbose Logging

**Backend:**
```powershell
# Set debug mode di .env
DEBUG=true

# Run dengan log level
python -m uvicorn server:app --log-level debug
```

**Frontend:**
```powershell
npm run web -- --verbose
```

---

### Check Process Health

```powershell
# Seluruh ports yang digunakan
netstat -ano

# Specific port
netstat -ano | findstr :8001
netstat -ano | findstr :3000
netstat -ano | findstr :27017
```

---

## 📞 Still Having Issues?

1. **Check logs** di `backend/debug_logs/`
2. **Copy error message** lengkap
3. **Cek** prerequisites di [Prerequisites](./01-prerequisites.md)
4. **Try fresh install:**
   - Delete `node_modules` dan `.venv`
   - Fresh `npm install` dan `pip install`

---

## ✅ Quick Health Check

Run this to verify everything:

```powershell
Write-Host "=== Checking Prerequisites ==="
python --version
node --version
npm --version
Get-Process mongod -ErrorAction SilentlyContinue | Write-Host "MongoDB: Running" -ForegroundColor Green

Write-Host "`n=== Checking Services ==="
try {
    (Invoke-WebRequest http://localhost:8001/api/health).StatusCode
    Write-Host "Backend: Running" -ForegroundColor Green
} catch {
    Write-Host "Backend: Not Running" -ForegroundColor Red
}

try {
    (Invoke-WebRequest http://localhost:3000).StatusCode
    Write-Host "Frontend: Running" -ForegroundColor Green
} catch {
    Write-Host "Frontend: Not Running" -ForegroundColor Red
}
```
