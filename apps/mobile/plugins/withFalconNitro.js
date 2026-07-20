/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const {
    withPodfileProperties,
    withGradleProperties,
} = require('expo/config-plugins')

/*
 * On-device Falcon-1024 signing (`@joe-p/react-native-falcon`, PQ-020).
 *
 * The package is a Nitro C++ HybridObject. Its native code (iOS pod via
 * `Falcon.podspec` + `nitrogen/generated/ios`, Android via `build.gradle` +
 * `CMakeLists.txt` + `nitrogen/generated/android`) is picked up automatically
 * by React Native / Nitro autolinking during `expo prebuild` — no manual
 * podspec or Gradle wiring is required, which is why there is no Podfile edit
 * here (contrast withMLKitSimulatorExclusion.js, which patches generated
 * xcconfigs).
 *
 * Nitro HybridObjects only work under the React Native New Architecture
 * (Fabric / TurboModules). Expo SDK 57 (RN 0.86) defaults New Arch ON, and the
 * app already ships other Nitro modules (react-native-mmkv keystore,
 * react-native-quick-crypto, react-native-nitro-image), so this is effectively
 * already true. This plugin pins the flag explicitly on both platforms so that
 * the on-device PQ signing prerequisite is a declared, self-documenting
 * invariant rather than an implicit default that a future Expo/RN bump could
 * flip. Both writes are idempotent (they set the same key to "true").
 *
 * SWAP: paired with packages/kms/src/crypto/pq/rnFalconProvider.ts (Seam A).
 *
 * NOTE (unverified pending device build — handed off to Task 9): the native
 * pod/Gradle autolinking and the on-device signature round-trip have not been
 * exercised on a real prebuild/device in this task. If autolinking needs a
 * nudge in this pnpm monorepo (symlinked node_modules), or the Nitro module
 * requires additional Podfile/Gradle wiring, that fix belongs in this plugin.
 */

const NEW_ARCH_KEY = 'newArchEnabled'
const NEW_ARCH_VALUE = 'true'

/**
 * Ensure `newArchEnabled=true` in Podfile.properties.json (iOS).
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withIosNewArch = config =>
    withPodfileProperties(config, podfileConfig => {
        podfileConfig.modResults[NEW_ARCH_KEY] = NEW_ARCH_VALUE
        return podfileConfig
    })

/**
 * Ensure `newArchEnabled=true` in android/gradle.properties (Android).
 * Upserts the property so a second run is a no-op.
 *
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withAndroidNewArch = config =>
    withGradleProperties(config, gradleConfig => {
        const existing = gradleConfig.modResults.find(
            item => item.type === 'property' && item.key === NEW_ARCH_KEY,
        )
        if (existing) {
            existing.value = NEW_ARCH_VALUE
        } else {
            gradleConfig.modResults.push({
                type: 'property',
                key: NEW_ARCH_KEY,
                value: NEW_ARCH_VALUE,
            })
        }
        return gradleConfig
    })

/**
 * @type {import('expo/config-plugins').ConfigPlugin}
 */
const withFalconNitro = config => withAndroidNewArch(withIosNewArch(config))

module.exports = withFalconNitro
module.exports.withIosNewArch = withIosNewArch
module.exports.withAndroidNewArch = withAndroidNewArch
