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
- On a release tag, Bitrise `web-production` uploads that zip to the Chrome Web Store item as its pending draft (`tools/release/upload-chrome-web-store.mjs`). It never publishes: submitting the draft for review stays a manual step in the Developer Dashboard. pera-ci's `web-production` uploads it the same way once `CI_UPLOADS_ENABLED` is on for its release pipeline; turn the Bitrise step off then, or the two CIs replace each other's draft. A `support/*` branch runs its own `.bitrise/bitrise.yml`, so it uploads only once that step is on the branch; until then, upload its zip by hand after checking it against its `.sha256`.
- The upload authenticates as a Google service account whose email is added under Account in the Developer Dashboard. A dashboard change to the item's visibility blocks publishing through the API until one manual publish, but not uploading.
- The same tag's zip goes to the Microsoft Edge Add-ons product as its draft submission (`tools/release/upload-edge-add-ons.mjs`, Add-ons API v1.1), right after the Chrome Web Store upload, on both CIs under the same conditions. It never publishes either: submit it for review in Partner Center. The API can't create a product, so the first listing is made by hand in Partner Center. Edge takes the zip; Verified CRX Uploads is a Chrome Web Store setting only.
- Verified CRX Uploads: with `CWS_CRX_SIGNING_KEY_BASE64` set, the upload is a CRX signed with that key (`tools/release/crx3.mjs`, the same bytes `chrome --pack-extension` writes) instead of the zip. Once the item has Verified CRX Uploads on, the store rejects anything else, so set the secret and see one release tag upload a CRX before opting in under Package in the Developer Dashboard with the key's public half (`openssl pkey -in key.pem -pubout`). Keep the private key offline as well: replacing a lost one goes through Chrome Web Store support and can take a week.
- Upload only a `production` zip. A staging zip talks to the staging backend and carries "(staging build)" in its description.
- A production zip carries no API key and needs `WEB_INTEGRITY_MINT_ENABLED`, `WEB_INTEGRITY_BEARER_ENABLED` and `WEB_INTEGRITY_ENROL_ENABLED` all on (`apps/browser/scripts/manifest.mjs` fails the build otherwise), so the production backend must accept enrolled web tokens before such a zip is uploaded.
- Shipping the extension alone: tag on the `support/vX.Y.Z` branch, then start Bitrise `web-production` by hand on that tag rather than the whole `release-builds` pipeline, so no mobile artifact is built for it. The same CI change also lands on `main`, because pera-ci reads `ci/pipelines.yml` only from there.
- The manifest `version` is the tag's `X.Y.Z` with the build number as a fourth part, and `version_name` is `X.Y.Z`. The store rejects a package whose `version` is not higher than the last one it accepted; the build number is what keeps two rcs of one version in order.

### Required Bitrise secrets

<!-- doc-hygiene-ignore-next-line stale-path reason: written by CI at build time, never committed -->

- `ANDROID_JSON_KEY_FILE`: Play service-account JSON (global secret; written to `apps/mobile/config/api-key.json`).
- `FIREBASE_SERVICE_ACCOUNT_BASE64`: Firebase service account (base64).
- `CWS_SERVICE_ACCOUNT_BASE64`, `CWS_PUBLISHER_ID`, `CWS_ITEM_ID`: Chrome Web Store service-account JSON key (base64, from the PeraCI Google Cloud project), publisher and extension item. Without them `web-production` fails at the upload step on a release tag, after the zip is built.
- `EDGE_CLIENT_ID`, `EDGE_API_KEY`, `EDGE_PRODUCT_ID`: from Partner Center > Microsoft Edge > Publish API, and the extension's product id. The API key has an expiry date, shown on that page; renew it there before it lapses, or the upload step fails on the next release tag.
- `CWS_CRX_SIGNING_KEY_BASE64`: optional (pera-ci requires the name, so store it empty there until the key exists). The Verified CRX Uploads signing key, a 2048-bit RSA private key in PEM (`openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`), base64. Unset, `web-production` uploads the zip.
- `PRODUCTION_FIREBASE_APP_ID_ANDROID`: Firebase Android app ID, aliased to `FIREBASE_APP_ID_ANDROID` by `setup-env-secrets.sh`. Required. If unset, the Firebase step aborts the release with `app: nil` _after_ the AAB is already on Play.
- `PRODUCTION_ANDROID_GOOGLE_SERVICES_BASE64`, `PRODUCTION_IOS_GOOGLE_SERVICE_INFO_BASE64`, and the iOS signing/profile secrets, as already used by the production workflows.

### Ops prerequisite

The package in `ANDROID_PACKAGE_NAME` (today `com.algorand.perarn`; `com.algorand.android` after WB‑1/WB‑2) MUST already exist in Play Console with an `internal` track, and the service account in `ANDROID_JSON_KEY_FILE` MUST have release access. A Play-accepted AAB is impossible until this is in place.
