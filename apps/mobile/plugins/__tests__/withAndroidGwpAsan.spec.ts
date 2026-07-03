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

import { describe, expect, it } from 'vitest'
import { setGwpAsanMode } from '../withAndroidGwpAsan'

// Shape of the parsed AndroidManifest that Expo's withAndroidManifest passes.
type AndroidManifest = {
    manifest: { application?: { $?: Record<string, string> }[] }
}

const manifestWith = (app: {
    $?: Record<string, string>
}): AndroidManifest => ({
    manifest: { application: [app] },
})

describe('setGwpAsanMode', () => {
    it('sets gwpAsanMode="always" on the application tag', () => {
        const result = setGwpAsanMode(manifestWith({ $: {} }))

        expect(
            result.manifest.application?.[0].$?.['android:gwpAsanMode'],
        ).toBe('always')
    })

    it('preserves existing application attributes', () => {
        const result = setGwpAsanMode(
            manifestWith({ $: { 'android:name': '.MainApplication' } }),
        )

        expect(result.manifest.application?.[0].$?.['android:name']).toBe(
            '.MainApplication',
        )
    })

    it('is idempotent across repeated prebuilds', () => {
        const once = setGwpAsanMode(manifestWith({ $: {} }))
        const twice = setGwpAsanMode(once)

        expect(twice.manifest.application?.[0].$?.['android:gwpAsanMode']).toBe(
            'always',
        )
    })

    it('throws when there is no application tag', () => {
        expect(() => setGwpAsanMode({ manifest: {} })).toThrow(
            /<application> not found/,
        )
    })
})
