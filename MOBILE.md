# TrainOS mobile builds

TrainOS now has native Capacitor 8 projects for iPhone/iPad and Android while retaining the local-first React workout engine. `dist/` is copied into each native application by `npm run mobile:sync`.

## What works on a phone

- Complete offline onboarding, workout generation, editing, set logging, completion, history, recovery, nutrition, progress, settings, export, and active-workout restoration.
- Native camera and photo-library capture for meal estimates and private progress photos.
- Native haptic feedback when a set or rest period completes.
- Optional lock-screen rest alerts. The app asks for notification access only when this setting is enabled.
- Phone safe areas, portrait iPhone layout, branded launch screens, and branded app icons.
- Local fitness data is excluded from iCloud app backup on iOS and Android application backup is disabled.

Native features fail soft: an in-app timer keeps working if notification access is revoked, and file/photo fallbacks remain available in the web build.

## Prepare native projects

```bash
npm install
npm run mobile:sync
```

This builds the web application, regenerates native artwork, copies the current bundle, and syncs Capacitor plugins.

## Run on an iPhone

1. Run `npm run ios:open`.
2. In Xcode, select the **App** target and **Signing & Capabilities**.
3. Choose the Apple development team that owns the app.
4. Connect an iPhone, enable Developer Mode if prompted, choose the phone as the run destination, and press Run.

The current temporary bundle identifier is `com.trainos.mobile`. Pick the final product name and a bundle identifier owned by you before creating the App Store Connect record.

## Run on Android

Install Android Studio and its supported JDK/SDK, then run:

```bash
npm run android:open
```

Choose a connected phone or emulator in Android Studio and run the `app` configuration. The current workstation does not have a Java runtime installed, so Android compilation must wait until that prerequisite is present.

## Send to 10 testers

For iPhone testers, use TestFlight rather than a localhost URL:

1. Finalize the name, bundle identifier, app icon, privacy policy URL, support URL, and App Store privacy answers.
2. Configure signing in Xcode and create the matching App Store Connect app.
3. Archive the **App** target, validate it, and upload it to App Store Connect.
4. Add internal testers immediately or submit the build for TestFlight beta review before inviting external testers.

For Android testers, use a Google Play internal-testing track or a signed internal APK/AAB. Do not distribute a debug build.

## Rebranding checklist

The working name remains TrainOS until a final name is chosen. A name change touches:

- `src/config/brand.ts`, `vite.config.ts`, and `index.html`;
- `capacitor.config.ts`;
- iOS display name and bundle identifier in Xcode;
- Android `app_name`, namespace, and application ID;
- native and web icons, store screenshots, privacy/support pages, and store listings.

Run `npm run mobile:assets` after approving a final mark, then `npm run mobile:sync`.

## Release boundaries

- The app is device-test ready after local signing, but it is not App Store submission ready until the final identity, policies, screenshots, account-deletion behavior for cloud accounts, production Supabase deployment, and signed archive are completed.
- IndexedDB is the immediate source of truth. Removing the app removes unsynced local history, so testers should use **Settings → Your data → Export all data** before uninstalling.
- Production cloud sync still needs cross-device restore/merge and deletion tombstones; the current implementation is an opt-in authenticated upload snapshot.
- Photo nutrition remains an estimate and always requires review before it is saved.
