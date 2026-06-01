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

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console -- Node-only prebuild script; console is the output channel. */

/**
 * Post-prebuild sanitizer for the generated iOS `project.pbxproj`.
 *
 * The `@algorandfoundation/react-native-passkey-autofill` config plugin injects
 * the credential-provider extension target with `DEVELOPMENT_TEAM` set to the
 * literal `$(DEVELOPMENT_TEAM)` written UNQUOTED. When no team id resolves, the
 * parens make the pbxproj unparseable and CocoaPods fails with:
 *   "Dictionary missing ';' after key-value pair for \"DEVELOPMENT_TEAM\"".
 *
 * The companion config plugin (`plugins/withPasskeyAutofillFixes.js`) tries to
 * quote it at the object level, but Expo's mod ordering means the autofill
 * plugin can inject the target AFTER that pass runs, so the unquoted value
 * survives into the file. Sanitizing the fully-written file here — AFTER
 * prebuild and BEFORE `pod install` — is order-independent and reliable. The
 * `expo:prebuild*` npm scripts run `expo prebuild --no-install`, then this, then
 * `pod install`.
 *
 * Defaults to an empty team (`""`) so a clean prebuild works with NO
 * `APPLE_TEAM_ID` (CI-safe); honors `APPLE_TEAM_ID` when set.
 *
 * DELETE alongside `plugins/withPasskeyAutofillFixes.js` once the upstream
 * package ships a quoted DEVELOPMENT_TEAM.
 */

const fs = require('fs')
const path = require('path')

const iosRoot = path.join(__dirname, '..', 'ios')

const main = () => {
    if (!fs.existsSync(iosRoot)) {
        console.log('[fix-development-team] no ios/ directory; skipping')
        return
    }
    const xcodeprojDir = fs
        .readdirSync(iosRoot)
        .find(entry => entry.endsWith('.xcodeproj'))
    if (!xcodeprojDir) {
        console.log('[fix-development-team] no .xcodeproj; skipping')
        return
    }
    const pbxPath = path.join(iosRoot, xcodeprojDir, 'project.pbxproj')
    if (!fs.existsSync(pbxPath)) {
        console.log('[fix-development-team] no project.pbxproj; skipping')
        return
    }

    const teamId = process.env.APPLE_TEAM_ID || ''
    const contents = fs.readFileSync(pbxPath, 'utf8')
    const sanitized = contents.replace(
        /DEVELOPMENT_TEAM\s*=\s*"?\$\(DEVELOPMENT_TEAM\)"?\s*;/g,
        `DEVELOPMENT_TEAM = "${teamId}";`,
    )
    if (sanitized === contents) {
        console.log('[fix-development-team] nothing to sanitize')
        return
    }
    fs.writeFileSync(pbxPath, sanitized)
    console.log(
        `[fix-development-team] quoted DEVELOPMENT_TEAM in ${xcodeprojDir} (team="${teamId}")`,
    )
}

main()
