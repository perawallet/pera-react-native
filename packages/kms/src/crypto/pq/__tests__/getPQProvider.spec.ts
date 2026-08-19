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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getPQProvider } from '../getPQProvider'

describe('getPQProvider', () => {
    it('returns a falcon1024 provider', () => {
        expect(getPQProvider().scheme).toBe('falcon1024')
    })

    it('memoizes the provider', () => {
        expect(getPQProvider()).toBe(getPQProvider())
    })

    it('selects the provider at build time, with no runtime platform sniffing', async () => {
        const source = await import('node:fs').then(fs =>
            fs.readFileSync(
                new URL('../getPQProvider.ts', import.meta.url),
                'utf8',
            ),
        )
        expect(source).not.toMatch(/navigator/)
        expect(source).not.toMatch(/isReactNative/)
        expect(source).not.toMatch(/createRNFalconProvider/)
    })

    it('ships an on-device override that uses the native provider', async () => {
        const source = await import('node:fs').then(fs =>
            fs.readFileSync(
                new URL('../getPQProvider.native.ts', import.meta.url),
                'utf8',
            ),
        )
        expect(source).toMatch(/createRNFalconProvider/)
        expect(source).not.toMatch(/createWasmFalconProvider/)
    })
})
