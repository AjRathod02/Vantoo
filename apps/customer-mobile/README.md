# Vantoo Customer Mobile

Native Android + iOS Expo app for customers. Talks to the Next.js API with bearer tokens.

## Setup

```bash
cd apps/customer-mobile
npm install
cp .env.example .env
npx expo start
```

Set `EXPO_PUBLIC_API_URL` to your machine LAN IP when testing on a physical device
(for example `http://192.168.1.20:3000`), not only `localhost`.

## Flows

- Sign in via `/api/auth/mobile/login`
- Catalog via `/api/customer/products`
- COD checkout via `/api/customer/orders`
- Orders + tracking via `/api/customer/orders/*`

## Store builds

Use EAS Build later for Play Store / App Store binaries. Dev testing: Expo Go or a development build.
