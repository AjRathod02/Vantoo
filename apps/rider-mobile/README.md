# Vantoo Rider Mobile

Separate Expo app for delivery partners. Auth via `/api/auth/mobile/login`, APIs under `/api/rider/*`.

```bash
cd apps/rider-mobile
npm install
cp .env.example .env
npx expo start
```

GPS sharing uses `expo-location` → `POST /api/rider/location` (approved rider required).
