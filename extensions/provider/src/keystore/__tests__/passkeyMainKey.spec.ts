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

import { describe, expect, it } from 'vitest'
import { PASSKEY_MAIN_KEY_SCHEME, passkeyMainKeyId } from '../passkeyMainKey'

/**
 * Wire-format pin, not a behaviour test. `keystore-chrome`'s
 * `webauthn/keystore-signer.ts` restates both constants (it cannot import this
 * module without pulling `react-native-mmkv` into the extension bundle) and
 * asserts the same literals in `keystore-signer.test.ts`. Every other assertion
 * in this repo calls `passkeyMainKeyId` itself, so without these two the
 * canonical formula could drift while all four suites stayed green.
 */
describe('passkey main key identity', () => {
    it('names the main key `<seedKeyId>-passkey-main`', () => {
        expect(passkeyMainKeyId('hd-1')).toBe('hd-1-passkey-main')
    })

    it('tags the main key with the `pbkdf2-p256` scheme', () => {
        expect(PASSKEY_MAIN_KEY_SCHEME).toBe('pbkdf2-p256')
    })
})
