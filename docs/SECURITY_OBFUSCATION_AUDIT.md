# Security Audit — Release Build Obfuscation, Minification & Package Size

**Date:** 2026-07-02
**Scope:** Verify obfuscation and minification are correctly applied to release builds on iOS and Android; confirm no source maps / debug symbols are exposed; flag any clear-text sensitive strings; measure release artifact sizes and identify reduction opportunities.
**Project:** `apps/mobile` — Expo prebuild (bare) React Native, Hermes engine, Fastlane + Bitrise release pipeline.

---

## Verdict at a glance

| Area | Android | iOS | Status |
| --- | --- | --- | --- |
| JS app code compiled to Hermes bytecode | ✅ enabled | ✅ enabled | Non-readable, **but decompilable** |
| Native code obfuscation | ❌ **R8/ProGuard OFF** | ✅ symbols stripped | ⚠️ Android gap |
| Minification / dead-code stripping | ❌ minify off, resources not shrunk | ✅ Release defaults + Hermes `-O` | ⚠️ Android gap |
| Source maps shipped in artifact | ❌ not shipped | ❌ not shipped | ✅ Good |
| Debug symbols exposed | ✅ stripped from APK | dSYM → Crashlytics, not in IPA | ✅ Good |
| Hardcoded secrets in clear text | None critical | None critical | ✅ Good |

**Headline:** The one concrete configuration gap is that **Android R8/ProGuard minification and resource shrinking are explicitly disabled**. The most important conceptual finding is that all of the wallet's business logic lives in the **JS layer**, which Hermes compiles to bytecode — non-human-readable, but **not true obfuscation**: Hermes bytecode is decompilable and function/property names and string literals are recoverable.

---

## 1. Obfuscation

React Native ships two distinct code layers, and they behave very differently. This split is the core of the audit.

### 1a. JS layer — where ~all of Pera's logic lives (both platforms)

Hermes is enabled on both platforms:

- Android — `hermesEnabled=true` — `apps/mobile/android/gradle.properties:46`
- iOS — `"expo.jsEngine": "hermes"` — `apps/mobile/ios/Podfile.properties.json:2`; `USE_HERMES = true` in the Release build config of `apps/mobile/ios/Pera7Dev.xcodeproj/project.pbxproj`

The release JS is compiled to Hermes bytecode (`main.jsbundle`). Metro JS minification is intentionally **off** for Hermes release builds (`--minify false` is injected by Expo's `react-native-xcode.sh`) because bytecode compilation supersedes it.

**Hermes bytecode is not an obfuscation mechanism.** Public tooling (`hbctool`, `hermes-dec`, `hasmer`) disassembles/decompiles Hermes bundles and recovers:

- Function and property names (Hermes preserves them for the runtime), and
- The entire string table verbatim — every string literal in the app.

This was demonstrated directly during this audit: compiling the release bundle with `hermesc` surfaced readable identifiers and strings straight from the bundle (`pickFileAsync`, `downloadProgress`, `AbortError`, `Content-Type`, …).

There is **no dedicated JS obfuscator** installed (`javascript-obfuscator`, `react-native-obfuscating-transformer`, etc.) — which is normal for RN, but it means the JS layer's protection ceiling is "bytecode," not "obfuscated." Metro config: `apps/mobile/metro.config.js`; custom transformer only handles `.sql`/`.svg`: `apps/mobile/metro-raw-transformer.js`.

**Conclusion for the scope items:** for the JS layer, class/method/variable names and string constants are **recoverable on both platforms**.

### 1b. Native layer — Android (Java/Kotlin): R8/ProGuard DISABLED ⚠️

- `android.enableMinifyInReleaseBuilds=false` — `apps/mobile/android/gradle.properties:73`
- `enableProguardInReleaseBuilds: false` (Expo config source of truth) — `apps/mobile/app.config.builder.js:309`
- Release buildType therefore ships `minifyEnabled false`, `shrinkResources false` — `apps/mobile/android/app/build.gradle:119-129`
- `apps/mobile/android/app/proguard-rules.pro` exists but is inert (only two `-keep` rules for Reanimated / TurboModule) because minify is off.

Native class/method names are human-readable in the APK/AAB. Impact is limited because the native layer is mostly RN framework + third-party modules, not proprietary logic — but this is the concrete "obfuscation not applied" gap.

### 1c. Native layer — iOS (Swift/ObjC): symbols stripped ✅

In the Release config of `apps/mobile/ios/Pera7Dev.xcodeproj/project.pbxproj`:

- `COPY_PHASE_STRIP = YES` — strips the symbol table from the shipped binary
- `VALIDATE_PRODUCT = YES`
- `DEAD_CODE_STRIPPING` / `STRIP_INSTALLED_PRODUCT` inherit Xcode's Release defaults (on)

Native symbols are stripped from the shipped binary; iOS native is in better shape than Android native here.

---

## 2. Source maps & debug symbols — no exposure ✅

- **Source maps are not shipped** in either artifact. Hermes composes a `.jsbundle.map` during the build but it is not packaged into the APK/AAB/IPA.
- **iOS dSYM** is generated separately and uploaded to Firebase Crashlytics, then the IPA ships without it — `apps/mobile/fastlane/Fastfile:208-212` (`upload_symbols_to_crashlytics`). Correct pattern.
- **Android** native debug symbols are stripped from the release artifact (Android defaults). Minor gap: they are **not uploaded** anywhere (Crashlytics symbol upload is iOS-only), so Android native crash stacks won't symbolicate — a diagnostics gap, not a security exposure.

---

## 3. Secrets / strings in clear text

No critical secrets are hardcoded.

- **Firebase config** (`apps/mobile/config/google-services.json`, `apps/mobile/config/GoogleService-Info.plist`) — API keys, project `pera-wallet-public`, sender IDs. These are **public-by-design** Firebase client SDK keys (project literally named `-public`); meant to ship, protected server-side, not by secrecy.
- **WalletConnect metadata, deep-link schemes, associated domains** — public by nature.
- **Private keys are never string literals in the bundle** — key handling lives in `packages/kms` and `packages/signing`, backed by native keystore (`react-native-keychain` + encrypted MMKV).

**Caveat (ties to §1):** because the Hermes string table is fully recoverable, any secret hardcoded into JS would be trivially extractable from a release build. Current code is clean; the guardrail to maintain is **"never embed a real secret in the JS bundle."**

---

## 4. Minification

- **Android:** off (R8 + `shrinkResources`) — the actionable gap (see §1b).
- **iOS:** native dead-code stripping via Release defaults; JS via Hermes `-O`. Effective.
- **JS (both):** Metro minify deliberately off under Hermes; bytecode `-O` is the equivalent. Working as intended.

---

## 5. Package size

### Measured (local, this audit)

Production bundle produced with `expo export:embed --platform android --dev false` (7,292 modules):

| Artifact | Size |
| --- | --- |
| Minified JS bundle (pre-Hermes text) | **11.1 MB** (11,685,304 bytes) |
| **Hermes bytecode (uncompressed, `hermesc -O`)** | **16.6 MB** (16,616,149 bytes) |
| Bundled assets copied by Metro (Android) | **5.8 MB** across 63 files |

Hermes bytecode compresses to roughly ~7–9 MB inside the packaged artifact. Real APK/AAB/IPA sizes were **not measurable locally** — the only on-disk artifact is a 177 MB **debug** APK (`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`), which is unrepresentative (all ABIs, no minify, dev tooling). **Authoritative release sizes must come from CI** (Bitrise stores the `.aab`/`.ipa`) or the Play Console App Bundle Explorer (per-device delivery size).

### Largest assets & actions taken

| Source asset | Before | Finding & action |
| --- | --- | --- |
| `assets/images/banners/retail-bg` | 924 KB base + 924 KB `@3x` (3270×1880, no `@2x`) | Base was a **byte-identical full-resolution copy** of `@3x`, and `@3x` was ~3× larger than every sibling banner. **✅ Rebuilt as a proper 1x/2x/3x set at 327/654/980px** (≈768 KB total). |
| `assets/images/pera-card.png` | 792 KB (3074×1938, no density variants) | Over-provisioned for a card visual. **✅ Downscaled to 1290px** (≈264 KB). |
| `assets/images/banners/staking-bg`, `card-bg` | base == `@3x` (981px) | Bases were byte-identical `@3x` copies. **✅ Regenerated true 1x bases (327px).** |
| `assets/images/onramp-intro-hero-{dark,light}` | 380 / 360 KB `@3x` (981px) | Correctly sized — **left unchanged**. |
| `assets/images/banners/generic-bg`, `governance-bg` | base 327px (correct 1x) | Already correct — **left unchanged**. |

**Result:** shipped image-asset payload **5988 KB → 4184 KB (~1.8 MB)**, before AAPT PNG crunch and R8 resource-shrinking reduce it further at build time. JS Hermes bytecode is unchanged (~16.6 MB — image assets are not part of the JS bundle).

### Reduction opportunities

| Opportunity | Status / impact | Notes |
| --- | --- | --- |
| Enable Android `minifyEnabled` + `shrinkResources` | **✅ Implemented** (~10–25% APK/AAB expected) | Also closes the native-obfuscation gap (§1b). Requires a release-build smoke test for keep-rules. |
| Right-size duplicated / over-provisioned images | **✅ Implemented** (~1.8 MB) | See table above. |
| Convert large statics to WebP | Not done (optional) | ~q80 WebP could shave more, but verify each image's iOS decode path (expo-image is webp-safe; RN core `Image` `require()` may not be). |
| Audit crypto lib overlap | Open (small) | `tweetnacl` may be redundant with `react-native-quick-crypto` for Ed25519 — verify before removing. |
| AAB already handles ABI/density/language splits | N/A | Play Store receives an AAB (`fastlane task: bundle`), so per-device slimming is automatic. The universal APK path (Firebase distribution) is not split, but that is internal testing only. |

### How to get authoritative numbers

```sh
# JS bundle + assets (safe, local, no signing):
cd apps/mobile
APP_ENV=production pnpm exec expo export:embed \
  --platform android --dev false --entry-file index.js \
  --bundle-output /tmp/bundle.android.js --assets-dest /tmp/assets.android
du -sh /tmp/bundle.android.js /tmp/assets.android

# Bundle composition:
npx react-native-bundle-visualizer
```

Real APK/AAB/IPA sizes: pull artifacts from the latest Bitrise release build, or use Play Console → App Bundle Explorer for delivered size.

---

## 6. Prioritized recommendations

1. **[Medium] Enable Android R8/ProGuard + resource shrinking** for release. **✅ Implemented** in `apps/mobile/app.config.builder.js` (expo-build-properties: `enableMinifyInReleaseBuilds: true`, `enableShrinkResourcesInReleaseBuilds: true`, plus a baseline `extraProguardRules`). The native files are generated by `expo prebuild`, so the Expo config is the source of truth. **Still required:** a signed release-build smoke test — R8 can strip classes reached via reflection; add module-specific `-keep` rules from the release run's `missing_rules.txt` / observed crashes, and measure the size delta.
2. **[Medium] Treat the JS layer as reverse-engineerable.** Hermes ≠ obfuscation. Maintain the "no secrets in the JS bundle" invariant. If the threat model requires hiding logic/strings, evaluate a Hermes-compatible JS obfuscation step — but weigh it against real benefit (rarely worth the build/debug cost for a non-custodial wallet whose security rests on the keystore, not code secrecy).
3. **[Low] Upload Android native symbols to Crashlytics** to match iOS, for symbolicated native crash reports (diagnostics, not security).
4. **[Low] Asset optimization** — **✅ Implemented** (`apps/mobile/assets`): right-sized the over-provisioned/duplicated banner PNGs and downscaled `pera-card.png` (see §5), cutting the shipped image-asset payload from **5988 KB → 4184 KB (~1.8 MB)** before AAPT crunch / R8 resource-shrink. JS Hermes bytecode is unchanged (~16.6 MB). Needs the release smoke test to confirm banners/card render correctly at the new resolutions. (Note: unused DMSans font weights were considered but left in place — they are not in the `expo-font` bundle list, so removing them saves no app size.)
5. **[Info] Record a release-size baseline** from CI artifacts so future regressions are visible.

---

## Appendix — key references

| Concern | File |
| --- | --- |
| Hermes (Android) | `apps/mobile/android/gradle.properties:46` |
| Hermes (iOS) | `apps/mobile/ios/Podfile.properties.json:2` |
| Android minify off | `apps/mobile/android/gradle.properties:73`, `apps/mobile/app.config.builder.js:309` |
| Android release buildType | `apps/mobile/android/app/build.gradle:119-129` |
| ProGuard rules (inert) | `apps/mobile/android/app/proguard-rules.pro` |
| iOS Release strip settings | `apps/mobile/ios/Pera7Dev.xcodeproj/project.pbxproj` |
| iOS dSYM → Crashlytics | `apps/mobile/fastlane/Fastfile:208-212` |
| Firebase public config | `apps/mobile/config/google-services.json`, `apps/mobile/config/GoogleService-Info.plist` |
| Key handling | `packages/kms`, `packages/signing` |
| Metro config / transformer | `apps/mobile/metro.config.js`, `apps/mobile/metro-raw-transformer.js` |
