# 📋 Prerequisites - Apa yang Perlu Diinstall

Sebelum mulai, pastikan Anda punya tools berikut:

## 1️⃣ Python 3.9+

**Cek versi:**
```powershell
python --version
```

**Jika belum punya:**
- Download dari [python.org](https://www.python.org/downloads/)
- Pilih versi 3.9 atau lebih baru
- ✅ **PENTING**: Centang "Add Python to PATH" saat install

## 2️⃣ Node.js & npm

**Cek versi:**
```powershell
node --version
npm --version
```

**Jika belum punya:**
- Download dari [nodejs.org](https://nodejs.org)
- Pilih LTS version (Long Term Support)
- npm akan otomatis terinstall bersama Node.js

## 3️⃣ MongoDB Community

**Cek apakah sudah running:**
```powershell
Get-Process mongod -ErrorAction SilentlyContinue
```

Jika hasilnya kosong, MongoDB belum terinstall.

**Install:**
- Download dari [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
- Default akan berjalan di `http://localhost:27017`
- ✅ Pastikan service "MongoDB" ter-checklist di Windows Services

## 4️⃣ Git (Optional)

**Untuk clone/update repo:**
```powershell
git --version
```

**Jika belum punya:**
- Download dari [git-scm.com](https://git-scm.com)

## ✅ Verification Checklist

```powershell
# Cek semua tools
python --version
node --version
npm --version
Get-Process mongod -ErrorAction SilentlyContinue
```

Jika semua terinstall dengan baik, lanjut ke **[Quick Start](./02-quick-start.md)**! 🎉
