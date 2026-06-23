/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Prebuild-assert gate for WB-2 / WB-7. Generates a production Android project,
// runs the Gradle manifest merger so library-contributed permissions resolve,
// then asserts the literal acceptance-criteria values in the merged manifest +
// build.gradle. Run from CI (Android production workflow) or locally before
// submission. Requires the Android toolchain + network; NOT part of `vitest run`.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const androidRoot = join(mobileRoot, 'android')

const APP_ID = 'com.algorand.android'

const failures = []
const assert = (condition, message) => {
    if (!condition) failures.push(message)
}

const env = {
    ...process.env,
    APP_ENV: 'production',
    PASSKEY_AUTOFILL_SITE: 'https://perawallet.app',
}
const run = (cmd, args, cwd) =>
    execFileSync(cmd, args, { cwd, stdio: 'inherit', env })

// 1. Generate the production Android project, then run the manifest merger.
run(
    'npx',
    ['expo', 'prebuild', '-p', 'android', '--no-install', '--clean'],
    mobileRoot,
)
// processReleaseManifest / processProdReleaseManifest runs the AGP manifest
// merger and writes the fully-merged manifest under build/intermediates.
run(
    './gradlew',
    [':app:processReleaseManifest', '--console=plain'],
    androidRoot,
)

// 2. Locate build.gradle + the merged manifest.
const buildGradle = readFileSync(join(androidRoot, 'app/build.gradle'), 'utf8')
// Expo generates targetSdkVersion in gradle.properties (android.targetSdkVersion=N)
// rather than inline in build.gradle; include it in the checked corpus.
const gradleProperties = readFileSync(
    join(androidRoot, 'gradle.properties'),
    'utf8',
)
// targetSdkCorpus combines build.gradle + gradle.properties ONLY for the
// targetSdkVersion check — applicationId/namespace still read buildGradle alone.
const targetSdkCorpus = buildGradle + '\n' + gradleProperties
const mergedRoot = join(androidRoot, 'app/build/intermediates/merged_manifests')

// AGP < 8: <mergedRoot>/<variant>/AndroidManifest.xml
// AGP >= 8: <mergedRoot>/<variant>/<task>/AndroidManifest.xml
// Walk up to two levels deep to handle both layouts.
const findMergedManifest = root => {
    const candidates = []
    for (const entry of readdirSync(root)) {
        if (!entry.toLowerCase().includes('release')) continue
        const variantPath = join(root, entry)
        if (!statSync(variantPath).isDirectory()) continue
        const flat = join(variantPath, 'AndroidManifest.xml')
        if (existsSync(flat)) {
            candidates.push(flat)
            continue
        }
        for (const sub of readdirSync(variantPath)) {
            const deep = join(variantPath, sub, 'AndroidManifest.xml')
            if (existsSync(deep)) candidates.push(deep)
        }
    }
    if (candidates.length > 1) {
        console.warn(
            '[verify-android-identity] WARNING: multiple release manifest candidates found — using first:',
            candidates,
        )
    }
    return candidates[0] ?? null
}
const manifestPath = findMergedManifest(mergedRoot)
if (!manifestPath) {
    console.error('[verify-android-identity] no merged release manifest found')
    process.exit(1)
}
const manifest = readFileSync(manifestPath, 'utf8')

// 3. Identity + SDK (build.gradle + gradle.properties).
assert(
    buildGradle.includes(`applicationId '${APP_ID}'`) ||
        buildGradle.includes(`applicationId "${APP_ID}"`),
    `applicationId ${APP_ID} not found`,
)
assert(
    buildGradle.includes(`namespace '${APP_ID}'`) ||
        buildGradle.includes(`namespace "${APP_ID}"`),
    `namespace ${APP_ID} not found`,
)
// Expo stores targetSdkVersion in gradle.properties (android.targetSdkVersion=N) rather
// than inline; the assertion checks both locations so it works across Expo/AGP versions.
// Two precise forms only — the over-broad `targetSdk\s*=?\s*36` middle branch is omitted.
assert(
    /targetSdkVersion\s+36|android\.targetSdkVersion\s*=\s*36/.test(
        targetSdkCorpus,
    ),
    'targetSdkVersion 36 not found',
)

// 4. Merged manifest — FileProvider authority, permissions, backup.
assert(
    manifest.includes(`android:authorities="${APP_ID}.fileprovider"`),
    `FileProvider authority ${APP_ID}.fileprovider not found`,
)
assert(
    manifest.includes('android.permission.POST_NOTIFICATIONS'),
    'POST_NOTIFICATIONS missing',
)
for (const removed of [
    'android.permission.RECORD_AUDIO',
    'android.permission.SYSTEM_ALERT_WINDOW',
]) {
    assert(
        !manifest.includes(removed),
        `${removed} should be blocked but is present`,
    )
}
for (const scoped of [
    'android.permission.BLUETOOTH',
    'android.permission.ACCESS_FINE_LOCATION',
]) {
    // AGP manifest merger may reorder XML attributes (maxSdkVersion before name or vice versa);
    // assert both attributes appear on the same <uses-permission> element regardless of order.
    const escapedName = scoped.replace(/\./g, '\\.')
    const nameFirst = new RegExp(
        `<uses-permission[^>]*android:name="${escapedName}"[^>]*android:maxSdkVersion="30"`,
    )
    const sdkFirst = new RegExp(
        `<uses-permission[^>]*android:maxSdkVersion="30"[^>]*android:name="${escapedName}"`,
    )
    assert(
        nameFirst.test(manifest) || sdkFirst.test(manifest),
        `${scoped} is not scoped to maxSdkVersion 30`,
    )
}
assert(/android:allowBackup="false"/.test(manifest), 'allowBackup is not false')
assert(
    /android:dataExtractionRules="@xml\/pera_data_extraction_rules"/.test(
        manifest,
    ),
    'dataExtractionRules not wired',
)
assert(
    /android:fullBackupContent="@xml\/pera_backup_rules"/.test(manifest),
    'fullBackupContent not wired',
)

// 5. Report.
if (failures.length > 0) {
    console.error('\n[verify-android-identity] FAILED:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
}
console.log(
    '\n[verify-android-identity] OK — production Android identity + manifest verified',
)
