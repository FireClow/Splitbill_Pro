# 🔧 Backend Setup - FastAPI + Python

Panduan detail setup backend SplitBill.

## 📁 Backend Structure

```
backend/
├── server.py              # FastAPI main app
├── receipt_processor.py   # OCR processing
├── requirements.txt       # Python dependencies
├── tests/                 # Test files
└── debug_logs/            # Log files
```

## 🚀 Installation

### 1. Navigate ke Backend Folder

```powershell
cd backend
```

### 2. Install Dependencies

```powershell
pip install -r requirements.txt
```

**Requirements termasuk:**
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pymongo` - MongoDB driver
- `pytesseract` - OCR processing
- `pillow` - Image processing
- `python-dotenv` - Environment variables
- Dan lainnya...

### 3. Setup Environment Variables

Buat file `.env` di folder `backend/`:

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=splitbill

# API
API_HOST=0.0.0.0
API_PORT=8001

# Environment
ENV=development
DEBUG=true

# OCR provider selection: auto | google_vision | tesseract
OCR_PROVIDER=auto
# Optional cloud OCR
GOOGLE_VISION_API_KEY=
# Optional explicit path
TESSERACT_CMD=C:\\Program Files\\Tesseract-OCR\\tesseract.exe
```

## ▶️ Start Backend

```powershell
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Flags:**
- `--reload` - Auto-restart saat ada perubahan file (development)
- `--host 0.0.0.0` - Bisa diakses dari komputer lain
- `--port 8001` - Port yang digunakan

**Output yang diharapkan:**
```
INFO:     Application startup complete
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

## 📚 API Documentation

Setelah backend running, buka:

```
http://localhost:8001/docs
```

Anda akan melihat Swagger UI dengan dokumentasi interaktif semua endpoint.

## 🧪 Testing

### Run All Tests

```powershell
cd backend
pytest
```

### Run Specific Test File

```powershell
pytest tests/test_01_health_and_auth.py -v
```

### Run dengan Coverage

```powershell
pytest --cov=. --cov-report=html
```

## 🔍 Debug

### JSON Logs

Semua logs ada di `backend/debug_logs/`:

```powershell
Get-Content debug_logs\ocr_text_*.txt | Select-Object -Last 10
```

### Check Database Connection

```powershell
python -c "import pymongo; print(pymongo.MongoClient('mongodb://localhost:27017').server_info())"
```

## 📋 Available Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/session` | Session exchange |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/bills` | List user's bills |
| POST | `/api/bills` | Create new bill |
| GET | `/api/bills/{id}` | Get bill detail |
| POST | `/api/ocr/process` | Process receipt image |

Lihat `/docs` untuk dokumentasi lengkap.

## 🛠️ Troubleshooting

**Port already in use?**
```powershell
netstat -ano | findstr :8001
taskkill /PID <PID> /F
```

**MongoDB connection error?**
→ Lihat [Troubleshooting](./05-troubleshooting.md)

**Import error?**
→ Pastikan sudah `pip install -r requirements.txt`
