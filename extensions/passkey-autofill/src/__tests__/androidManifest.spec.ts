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

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The passkey activities trust every extra they are started with, so an exported one lets any
// installed app obtain a signed assertion. Our pnpm patch un-exports them; this fails if a
// version bump or patch rebase drops that hunk.
const readInstalledManifest = (): string => {
    const require = createRequire(import.meta.url)
    const packageDir = dirname(
        require.resolve('@algorandfoundation/react-native-passkey-autofill/package.json'),
    )
    return readFileSync(
        join(packageDir, 'android/src/main/AndroidManifest.xml'),
        'utf8',
    )
}

const openingTags = (manifest: string, pattern: RegExp): string[] =>
    manifest.match(pattern) ?? []

describe('react-native-passkey-autofill Android manifest', () => {
    it('declares every activity and activity alias as not exported', () => {
        const activities = openingTags(
            readInstalledManifest(),
            /<activity(?:-alias)?\b[^>]*>/g,
        )

        expect(activities.length).toBeGreaterThanOrEqual(2)
        expect(
            activities.filter(tag => !/android:exported="false"/.test(tag)),
        ).toEqual([])
    })

    it('keeps the credential provider service behind the system bind permission', () => {
        const services = openingTags(
            readInstalledManifest(),
            /<service\b[^>]*>/g,
        )

        expect(services).toHaveLength(1)
        expect(services[0]).toContain(
            'android:permission="android.permission.BIND_CREDENTIAL_PROVIDER_SERVICE"',
        )
    })
})
