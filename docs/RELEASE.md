## Production store submission (tag `v.*`)

A `v.*` tag triggers the Bitrise `release-builds` pipeline → `ios-production` + `android-production`.

### iOS
- Builds the `Pera7Production` scheme and uploads to **TestFlight** (`fastlane ios deploy_testflight`).
- Promotion to the App Store (with phased release) is **manual** from App Store Connect.

### Android
- Builds an **AAB**, uploads to the Play **`internal`** track (`fastlane android deploy_internal`), and distributes an APK to Firebase App Distribution (`pera,pera-alpha`) in parallel.
- Promotion to production (with staged rollout %) is **manual** from Play Console.

### Required Bitrise secrets
- `ANDROID_JSON_KEY_FILE` — Play service-account JSON (global secret; written to `apps/mobile/config/api-key.json`).
- `FIREBASE_SERVICE_ACCOUNT_BASE64` — Firebase service account (base64).
- `PRODUCTION_FIREBASE_APP_ID_ANDROID`, `PRODUCTION_ANDROID_GOOGLE_SERVICES_BASE64`, `PRODUCTION_IOS_GOOGLE_SERVICE_INFO_BASE64`, iOS signing/profile secrets — as already used by the production workflows.

### Ops prerequisite (blocks the AC)
The package in `ANDROID_PACKAGE_NAME` (today `com.algorand.perarn`; `com.algorand.android` after WB‑1/WB‑2) MUST already exist in Play Console with an **internal** track, and the service account in `ANDROID_JSON_KEY_FILE` MUST have release access. The "Play-accepted AAB" acceptance criterion only passes once this is in place.
