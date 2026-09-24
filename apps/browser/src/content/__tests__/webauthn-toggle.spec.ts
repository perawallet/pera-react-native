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

import { describe, it, expect } from 'vitest'
import { parseWebauthnInterceptionEnabled } from '../webauthn-toggle'

describe('parseWebauthnInterceptionEnabled', () => {
    it('reads true from the persisted zustand envelope string', () => {
        const raw =
            '{"state":{"preferences":{"webauthnInterceptionEnabled":true}},"version":1}'
        expect(parseWebauthnInterceptionEnabled(raw)).toBe(true)
    })

    it('reads false from the persisted envelope when the preference is explicitly false', () => {
        const raw =
            '{"state":{"preferences":{"webauthnInterceptionEnabled":false}},"version":1}'
        expect(parseWebauthnInterceptionEnabled(raw)).toBe(false)
    })

    it('defaults to false (opt-in) when the entry is missing (undefined)', () => {
        expect(parseWebauthnInterceptionEnabled(undefined)).toBe(false)
    })

    it('defaults to false on malformed JSON', () => {
        expect(parseWebauthnInterceptionEnabled('{not json')).toBe(false)
    })

    it('defaults to false when preferences is absent from an otherwise valid envelope', () => {
        expect(parseWebauthnInterceptionEnabled('{"state":{}}')).toBe(false)
    })

    it('defaults to false when the preference key holds a non-boolean value', () => {
        const raw =
            '{"state":{"preferences":{"webauthnInterceptionEnabled":"true"}}}'
        expect(parseWebauthnInterceptionEnabled(raw)).toBe(false)
    })

    it('ignores unrelated preferences and still defaults to false', () => {
        const raw = '{"state":{"preferences":{"someOtherFlag":true}}}'
        expect(parseWebauthnInterceptionEnabled(raw)).toBe(false)
    })
})
