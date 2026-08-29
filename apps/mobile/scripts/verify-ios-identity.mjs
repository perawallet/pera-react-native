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

// Prebuild-assert gate. Generates a production iOS project and
// asserts the literal acceptance-criteria values in the emitted native files.
// Run from CI (iOS production workflow) or locally before submission. Requires
// the Expo iOS toolchain + network; NOT part of `vitest run`.

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const iosRoot = join(mobileRoot, 'ios')

const TEAM_ID = '87QL82XC78'
const BUNDLE_ID = 'com.algorandllc.algorand'
const APP_GROUP = 'group.com.algorandllc.algorand'

const failures = []
const assert = (condition, message) => {
    if (!condition) failures.push(message)
}

const env = {
    ...process.env,
    APP_ENV: 'production',
    IOS_TEAM_ID: TEAM_ID,
    PASSKEY_AUTOFILL_SITE: 'https://perawallet.app',
}
const run = (cmd, args) =>
    execFileSync(cmd, args, { cwd: mobileRoot, stdio: 'inherit', env })

// 1. Generate the production iOS project (skip pods for speed) + sanitize teams.
run('npx', ['expo', 'prebuild', '-p', 'ios', '--no-install', '--clean'])
run('node', ['scripts/fix-development-team.js'])

// 2. Locate the generated files.
const xcodeproj = readdirSync(iosRoot).find(entry =>
    entry.endsWith('.xcodeproj'),
)
if (!xcodeproj) {
    console.error('[verify-ios-identity] no .xcodeproj generated')
    process.exit(1)
}
const pbx = readFileSync(join(iosRoot, xcodeproj, 'project.pbxproj'), 'utf8')

// The app source dir is the one holding the .entitlements (excludes Pods/.xcodeproj).
const appDir = readdirSync(iosRoot).find(entry => {
    const full = join(iosRoot, entry)
    if (
        !statSync(full).isDirectory() ||
        entry.endsWith('.xcodeproj') ||
        entry === 'Pods'
    ) {
        return false
    }
    const children = readdirSync(full)
    return (
        children.some(file => file.endsWith('.entitlements')) &&
        children.includes('Info.plist')
    )
})
if (!appDir) {
    console.error('[verify-ios-identity] no app source dir with entitlements')
    process.exit(1)
}
const appPath = join(iosRoot, appDir)
const entitlementsFile = readdirSync(appPath).find(file =>
    file.endsWith('.entitlements'),
)
const entitlements = readFileSync(join(appPath, entitlementsFile), 'utf8')
const infoPlist = readFileSync(join(appPath, 'Info.plist'), 'utf8')

// 3. pbxproj — bundle id + DEVELOPMENT_TEAM on every target (app + extension).
assert(
    pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = "${BUNDLE_ID}";`) ||
        pbx.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE_ID};`),
    `PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE_ID} not found (quoted or unquoted)`,
)
const teamLines = pbx.match(/DEVELOPMENT_TEAM = .*?;/g) || []
assert(teamLines.length > 0, 'no DEVELOPMENT_TEAM assignments found')
assert(
    teamLines.every(
        line =>
            line === `DEVELOPMENT_TEAM = ${TEAM_ID};` ||
            line === `DEVELOPMENT_TEAM = "${TEAM_ID}";`,
    ),
    `every DEVELOPMENT_TEAM must equal ${TEAM_ID}; got: ${teamLines.join(' | ')}`,
)

// 4. Entitlements — App Group, full associated-domains, aps + appattest + autofill.
assert(entitlements.includes(APP_GROUP), `App Group ${APP_GROUP} not found`)
for (const domain of [
    '<string>applinks:perawallet.app</string>',
    '<string>applinks:perawallet</string>',
    '<string>webcredentials:perawallet.app</string>',
]) {
    assert(entitlements.includes(domain), `associated-domain ${domain} not found`)
}
// 4b. Info.plist — all six native-parity URL schemes registered.
for (const scheme of [
    'perawallet',
    'algorand',
    'wc',
    'perawallet-wc',
    'algorand-wc',
    'liquid',
]) {
    assert(
        infoPlist.includes(`<string>${scheme}</string>`),
        `URL scheme ${scheme} not found in CFBundleURLSchemes`,
    )
}
assert(
    /<key>aps-environment<\/key>\s*<string>production<\/string>/.test(
        entitlements,
    ),
    'aps-environment is not production',
)
assert(
    /<key>com\.apple\.developer\.devicecheck\.appattest-environment<\/key>\s*<string>production<\/string>/.test(
        entitlements,
    ),
    'appattest-environment is not production',
)
assert(
    /<key>com\.apple\.developer\.authentication-services\.autofill-credential-provider<\/key>\s*<true\/>/.test(
        entitlements,
    ),
    'autofill-credential-provider entitlement is not true',
)

// 5. Info.plist — non-exempt encryption flag.
assert(
    /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(infoPlist),
    'ITSAppUsesNonExemptEncryption is not false',
)

// 6. Report.
if (failures.length > 0) {
    console.error('\n[verify-ios-identity] FAILED:')
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exit(1)
}
console.log('\n[verify-ios-identity] OK — production iOS identity + entitlements verified')
