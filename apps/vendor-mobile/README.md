# Vantoo Vendor Mobile

Separate Expo app for vendors. Authenticates with `/api/auth/mobile/login` and calls `/api/vendor/*`.

```bash
cd apps/vendor-mobile
npm install
cp .env.example .env
npx expo start
```

Requires Next.js on `EXPO_PUBLIC_API_URL`. Full vendor data needs `PLATFORM_ENABLED=true` and platform services running.
