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
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=splitbill

# API
API_HOST=0.0.0.0
API_PORT=8001

# Environment
ENV=development
DEBUG=true

# Security (generate dengan secrets.token_urlsafe(32))
SECRET_KEY=your-secret-key-here

# Optional: OCR
TESSERACT_PATH=C:\\Program Files\\Tesseract-OCR\\tesseract.exe
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
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| GET | `/api/bills` | List user's bills |
| POST | `/api/bills` | Create new bill |
| GET | `/api/bills/{id}` | Get bill detail |
| POST | `/api/ocr/process` | Process receipt image |

Lihat `/docs` untuk dokumentasi lengkap.

## 🛠️ Troubleshooting

**Port already in use?**
```powershell
# Kill process on port 8001
lsof -ti:8001 | xargs kill -9
```

**MongoDB connection error?**
→ Lihat [Troubleshooting](./05-troubleshooting.md)

**Import error?**
→ Pastikan sudah `pip install -r requirements.txt`
