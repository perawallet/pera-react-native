## Production store submission (tag `v.*`)

An rc (`-rc.N`) or stable (`vX.Y.Z`) tag triggers the Bitrise `release-builds` pipeline → `ios-production` + `android-production`.

Staging and production are built by separate pipelines so a nightly does not burn four build machines:

| Tag              | Pipeline         | Builds                                  | Smoke gate |
| ---------------- | ---------------- | --------------------------------------- | ---------- |
| `vX.Y.Z-alpha.N` | `nightly-builds` | `ios-staging` + `android-staging`       | yes        |
| `vX.Y.Z-rc.N`    | `release-builds` | `ios-production` + `android-production` | no         |
| `vX.Y.Z`         | `release-builds` | `ios-production` + `android-production` | no         |

The smoke gate only runs on staging builds: they are the only ones that bake `DISABLE_SCREEN_CAPTURE_PREVENTION`, and Appium cannot drive a `FLAG_SECURE` surface — a production build hangs rather than failing usefully. An rc is therefore covered by the nightlies it descends from, not directly. Production is likewise not built nightly, so a production-only break (scheme, signing, flavor) surfaces at rc time rather than the next morning.

### Cutting a golden release

Run the **Promote RC to Release** workflow from the Actions tab. It tags the most recent rc's commit with the equivalent stable version (`v7.0.2-rc.3` → `v7.0.2`), publishes the GitHub Release, and fires the production builds. Leave the input blank to promote the highest rc, or name an older one explicitly.

It tags the rc's _commit_, not `main` — that commit is what was built and put in front of QA. No version bump is needed afterwards: `create-nightly-tag.sh` sees the new stable tag and rolls subsequent prereleases to the next patch.

### iOS

- Builds the `Pera7Production` scheme and uploads to **TestFlight** (`fastlane ios deploy_testflight`).
- Promotion to the App Store (with phased release) is **manual** from App Store Connect.

### Android

- Builds an **AAB** and uploads it to the Play **`internal`** track (`fastlane android deploy_internal`), then builds an APK and distributes it to Firebase App Distribution (`pera,pera-alpha`). Both run sequentially within the one lane, and the Firebase step is intentionally **fatal** — a Firebase failure fails the workflow even after the Play upload has already succeeded.
- Promotion to production (with staged rollout %) is **manual** from Play Console.

### Required Bitrise secrets

- `ANDROID_JSON_KEY_FILE` — Play service-account JSON (global secret; written to `apps/mobile/config/api-key.json`).
- `FIREBASE_SERVICE_ACCOUNT_BASE64` — Firebase service account (base64).
- `PRODUCTION_FIREBASE_APP_ID_ANDROID` — Firebase Android app ID, aliased to `FIREBASE_APP_ID_ANDROID` by `setup-env-secrets.sh`. **Required:** if unset, the Firebase step aborts the release with `app: nil` _after_ the AAB is already on Play.
- `PRODUCTION_ANDROID_GOOGLE_SERVICES_BASE64`, `PRODUCTION_IOS_GOOGLE_SERVICE_INFO_BASE64`, iOS signing/profile secrets — as already used by the production workflows.

### Ops prerequisite (blocks the AC)

The package in `ANDROID_PACKAGE_NAME` (today `com.algorand.perarn`; `com.algorand.android` after WB‑1/WB‑2) MUST already exist in Play Console with an **internal** track, and the service account in `ANDROID_JSON_KEY_FILE` MUST have release access. The "Play-accepted AAB" acceptance criterion only passes once this is in place.
