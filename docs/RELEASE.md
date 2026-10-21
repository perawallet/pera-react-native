## Production store submission (tag `v.*`)

An rc (`-rc.N`) or stable (`vX.Y.Z`) tag triggers the Bitrise `release-builds` pipeline → `ios-production` + `android-production` + `web-production`.

Staging and production are built by separate pipelines so a nightly does not burn four build machines:

| Tag              | Pipeline         | Builds                                                     | Smoke gate |
| ---------------- | ---------------- | ---------------------------------------------------------- | ---------- |
| `vX.Y.Z-alpha.N` | `nightly-builds` | `ios-staging` + `android-staging` + `web-staging`          | yes        |
| `vX.Y.Z-rc.N`    | `release-builds` | `ios-production` + `android-production` + `web-production` | no         |
| `vX.Y.Z`         | `release-builds` | `ios-production` + `android-production` + `web-production` | no         |

The smoke gate only runs on staging builds: they are the only ones that bake `DISABLE_SCREEN_CAPTURE_PREVENTION`, and Appium cannot drive a `FLAG_SECURE` surface, so a production build hangs rather than failing usefully. An rc is therefore covered by the nightlies it descends from, not directly. Production is likewise not built nightly, so a production-only break (scheme, signing, flavor) surfaces at rc time rather than the next morning.

An rc shows the plain `X.Y.Z` in the settings footer, the same string its stable promotion shows, because it ships under the version it is a candidate for: the iOS and Android builds bake its tag into the app config without the `-rc.N` suffix. The build number beside it is what identifies the exact build. Nightlies keep their `-alpha.N`. Note that iOS and Android build numbers for one rc are not comparable: Android adds `BUILD_NUMBER_OFFSET` to the Bitrise counter and iOS does not.

### Cutting a golden release

Run the `Release / Stable` workflow from the Actions tab. It tags the most recent rc's commit with the equivalent stable version (`v7.0.2-rc.3` → `v7.0.2`), publishes the GitHub Release, and fires the production builds. Leave the input blank to promote the highest rc, or name an older one explicitly.

It tags the rc's _commit_, not `main`: that commit is what was built and put in front of QA. No version bump is needed afterwards: `create-prerelease-tag.sh` sees the new stable tag and rolls subsequent prereleases to the next patch.

### Moving to a new minor or major version

Push the first prerelease of the new version by hand (`git tag -a v7.2.0-rc.1 -m v7.2.0-rc.1 && git push origin v7.2.0-rc.1`). `create-prerelease-tag.sh` follows the highest prerelease base it finds, so the nightlies and the biweekly rc continue as `v7.2.0-alpha.N` and `v7.2.0-rc.N` with no `package.json` bump. The marketing version comes from the tag, not `package.json`. A mistyped higher tag captures every channel until it is deleted from origin.

### iOS

- Builds the `Pera7Production` scheme and uploads to TestFlight (`fastlane ios deploy_testflight`).
- Promotion to the App Store (with phased release) is manual from App Store Connect.

### Android

- Builds an AAB and uploads it to the Play `internal` track (`fastlane android deploy_internal`), then builds an APK and distributes it to Firebase App Distribution (`pera,pera-alpha`). Both run sequentially within the one lane, and the Firebase step is intentionally fatal: a Firebase failure fails the workflow even after the Play upload has already succeeded.
- Promotion to production (with staged rollout %) is manual from Play Console.

### Browser extension

- Builds a zip of `apps/browser/dist`, `pera-extension-web-<environment>-<tag>-<sha7>.zip`, with a `.sha256` beside it.
- On a release tag, Bitrise `web-production` uploads the package to the Chrome Web Store item as its pending draft (`tools/release/upload-chrome-web-store.mjs`). It never publishes: submitting the draft for review stays a manual step in the Developer Dashboard. pera-ci builds the same zip but does not upload it, so the store only ever receives Bitrise's build.
- With `CWS_CRX_SIGNING_KEY_BASE64` set, `tools/release/sign-extension-crx.mjs` first wraps the zip, byte for byte, in a CRX3 signed with that key, and the `.crx` is what is uploaded and deployed as an artifact with its own `.sha256`. The store's "Verified CRX uploads" setting (Package tab of the Developer Dashboard) rejects a plain zip, so after the opt-in a manual upload must use the `.crx` artifact, and the secret and the opt-in have to go live together. Without the secret the zip is uploaded, which the store accepts only while the setting is off.
- The signing key is an RSA 2048 pair made by hand, `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out cws-crx-signing-key.pem`; the secret is the PEM base64-encoded (`base64 < cws-crx-signing-key.pem | tr -d '\n'`), and the public half, `openssl pkey -in cws-crx-signing-key.pem -pubout`, is what the opt-in asks for. Keep the private key offline with two holders and outside any Google account: a lost key means a support ticket and up to a week without updates, and a dashboard account that is taken over cannot upload a package without it.
- A `support/*` branch runs its own `.bitrise/bitrise.yml`, so it signs and uploads only once both steps are on the branch; until then, upload by hand after checking the artifact against its `.sha256` (the `.crx`, once the opt-in is on).
- The upload authenticates as a Google service account whose email is added under Account in the Developer Dashboard. A dashboard change to the item's visibility blocks publishing through the API until one manual publish, but not uploading.
- Upload only a `production` package. A staging zip talks to the staging backend and carries "(staging build)" in its description.
- A production zip carries no API key and needs `WEB_INTEGRITY_MINT_ENABLED`, `WEB_INTEGRITY_BEARER_ENABLED` and `WEB_INTEGRITY_ENROL_ENABLED` all on (`apps/browser/scripts/manifest.mjs` fails the build otherwise), so the production backend must accept enrolled web tokens before its package is uploaded.
- Shipping the extension alone: tag on the `support/vX.Y.Z` branch, then start Bitrise `web-production` by hand on that tag rather than the whole `release-builds` pipeline, so no mobile artifact is built for it. The same CI change also lands on `main`, because pera-ci reads `ci/pipelines.yml` only from there.
- The manifest `version` is the tag's `X.Y.Z` with the build number as a fourth part, and `version_name` is `X.Y.Z`. The store rejects a package whose `version` is not higher than the last one it accepted; the build number is what keeps two rcs of one version in order.

### Required Bitrise secrets

<!-- doc-hygiene-ignore-next-line stale-path reason: written by CI at build time, never committed -->

- `ANDROID_JSON_KEY_FILE`: Play service-account JSON (global secret; written to `apps/mobile/config/api-key.json`).
- `FIREBASE_SERVICE_ACCOUNT_BASE64`: Firebase service account (base64).
- `CWS_SERVICE_ACCOUNT_BASE64`, `CWS_PUBLISHER_ID`, `CWS_ITEM_ID`: Chrome Web Store service-account JSON key (base64, from the PeraCI Google Cloud project), publisher and extension item. Without them `web-production` fails at the upload step on a release tag, after the zip is built.
- `CWS_CRX_SIGNING_KEY_BASE64`: RSA 2048 private key PEM, base64, that signs the extension CRX. Protected and not exposed to pull-request builds. Optional until the store's verified-CRX opt-in; required after it, or every upload is rejected.
- `PRODUCTION_FIREBASE_APP_ID_ANDROID`: Firebase Android app ID, aliased to `FIREBASE_APP_ID_ANDROID` by `setup-env-secrets.sh`. Required. If unset, the Firebase step aborts the release with `app: nil` _after_ the AAB is already on Play.
- `PRODUCTION_ANDROID_GOOGLE_SERVICES_BASE64`, `PRODUCTION_IOS_GOOGLE_SERVICE_INFO_BASE64`, and the iOS signing/profile secrets, as already used by the production workflows.

### Ops prerequisite

The package in `ANDROID_PACKAGE_NAME` (today `com.algorand.perarn`; `com.algorand.android` after WB‑1/WB‑2) MUST already exist in Play Console with an `internal` track, and the service account in `ANDROID_JSON_KEY_FILE` MUST have release access. A Play-accepted AAB is impossible until this is in place.
