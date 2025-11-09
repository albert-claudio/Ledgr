# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## IGDB Integration

This app now uses IGDB instead of RAWG.

- Create a Twitch Developer application to obtain a Client ID and Client Secret: https://dev.twitch.tv/console/apps
- Add the following variables to `.env` (already present):
  - `EXPO_PUBLIC_TWITCH_CLIENT_ID`
  - `EXPO_PUBLIC_TWITCH_CLIENT_SECRET`
  - `EXPO_PUBLIC_IGDB_SWITCH_PLATFORM_ID` (optional, defaults to 130)

Security note: Shipping the Twitch Client Secret in a client app is not recommended for production. Prefer a small backend or edge function to fetch an app access token and/or proxy IGDB requests.

### Supabase Edge Function Proxy (Recommended)

We added a Supabase Edge Function that proxies IGDB calls, so the app never needs your Twitch secret.

Files:
- `supabase/functions/igdb/index.ts` — Deno Edge Function
- Client calls via `lib/api.ts` and `services/igdb.ts`

Setup:
- Install Supabase CLI: https://supabase.com/docs/guides/cli
- Log in and link your project.
- Set secrets in your Supabase project:
  - `TWITCH_CLIENT_ID`
  - `TWITCH_CLIENT_SECRET`

Commands:
```
supabase secrets set TWITCH_CLIENT_ID=xxxx TWITCH_CLIENT_SECRET=yyyy
supabase functions deploy igdb --no-verify-jwt
```

Client env (.env):
- `EXPO_PUBLIC_SUPABASE_URL` — already present
- `EXPO_PUBLIC_SUPABASE_IGDB_FUNCTION=igdb` — optional (defaults to `igdb`)
- Optional for local dev: `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=http://localhost:54321/functions/v1`

Local dev (optional):
```
supabase functions serve igdb --no-verify-jwt
# then set EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=http://localhost:54321/functions/v1
```

### Migration Notes

- Replaced RAWG service with `services/igdb.ts` and updated hooks `usePopularThisMonth` and `useNewAndPopular`.
- Game details and screenshots now come from IGDB via `services/gameDetail.ts`.
- Existing UI types are preserved by mapping IGDB fields to RAWG-like shapes.
- Update `.env` with your Twitch credentials and restart the dev server.
