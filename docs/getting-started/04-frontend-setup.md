# 🎨 Frontend Setup - React Native + Expo

Panduan detail setup frontend SplitBill.

## 📁 Frontend Structure

```
frontend/
├── app/                   # Expo Router app
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── login.tsx
│   ├── (tabs)/            # Tab navigation
│   └── bill/[id].tsx
├── components/            # Reusable components
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions
├── types/                 # TypeScript types
├── assets/                # Images, fonts
└── package.json
```

## 🚀 Installation

### 1. Navigate ke Frontend Folder

```powershell
cd frontend
```

### 2. Install Dependencies

```powershell
npm install
```

**atau dengan Yarn:**

```powershell
yarn install
```

### 3. Setup Environment Variables

Buat file `.env` di folder `frontend/`:

```env
# API
EXPO_PUBLIC_API_URL=http://localhost:8001/api
EXPO_PUBLIC_ENV=development

# AdMob (optional)
EXPO_PUBLIC_ADMOB_APP_ID=ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
EXPO_PUBLIC_ADMOB_BANNER_ID=ca-app-pub-3940256099942544/2934735716
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=ca-app-pub-3940256099942544/1033173712
```

## ▶️ Start Frontend

### Web Version (Recommended for Development)

```powershell
npm run web
```

**Output yang diharapkan:**
```
Local:          http://localhost:3000
Tunnel:         <tunnel-url>
Logs:           Press 'j' to open debugger at http://localhost:19000

Press 'i' │ 'a' │ 'w' │ '.' to switch between different
environments
```

Browser akan otomatis buka di `http://localhost:3000`

### Mobile Version (Expo Go)

```powershell
npx expo start
```

Scan QR code dengan Expo Go app di smartphone Anda.

## 🛠️ Build & Deploy

### Build for Web

```powershell
npm run build:web
```

Output akan ada di `build/` folder.

### Build for Android

```powershell
eas build --platform android --profile preview
```

Butuh setup EAS (Expo Application Services) dulu.

## 📝 TypeScript Config

Frontend menggunakan **strict TypeScript**. Cek `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "target": "ES2020"
  }
}
```

## 🔧 Development Tips

### Hot Reload

Otomatis trigger saat ada perubahan file:

```powershell
# Sedang running, tekan:
r - reload
c - clear console
d - open debugger
```

### Debug Tools

```powershell
# Chrome DevTools
Press 'd' saat expo start running
```

### ESLint

Cek code quality:

```powershell
npm run lint
```

### Format Code

```powershell
npm run format
```

## 📚 Project Teknologi

| Teknologi | Versi | Untuk |
|-----------|-------|-------|
| React Native | Latest | Mobile framework |
| Expo | Latest | Native tooling |
| TypeScript | 5+ | Type safety |
| Expo Router | Latest | Navigation |
| React Hooks | - | State management |

## 🎯 Main Features

- ✅ Bill creation & management
- ✅ Receipt scanning (OCR)
- ✅ Item splitting
- ✅ Payment tracking
- ✅ User authentication
- ✅ Real-time sync
- ✅ Bank ads (AdMob)

## 🧪 Testing

```powershell
# Run tests (jika ada)
npm test

# Test coverage
npm test -- --coverage
```

## 🚨 Common Issues

**Port 3000 already in use?**
```powershell
# Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**Dependencies issue?**
```powershell
# Clean install
rm -r node_modules package-lock.json
npm install
```

**API connection error?**
→ Pastikan backend running di `http://localhost:8001`

Lihat [Troubleshooting](./05-troubleshooting.md) untuk solusi lengkap.
