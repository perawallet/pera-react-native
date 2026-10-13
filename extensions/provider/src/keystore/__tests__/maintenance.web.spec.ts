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

import { describe, expect, test } from 'vitest'
import {
    hasKeyMaterial,
    runPasskeyCredentialSplit,
    writePasskeyCredential,
} from '../maintenance.web'

describe('maintenance (web)', () => {
    // The extension's passkeys hold no material of their own, so none of them
    // may be spared by the wallet-removal cascade.
    test('reports no key material and splits nothing', async () => {
        expect(hasKeyMaterial('anything')).toBe(false)
        await expect(runPasskeyCredentialSplit()).resolves.toEqual({
            split: [],
            normalized: [],
            failed: [],
        })
    })

    test('refuses to write a native passkey credential', async () => {
        await expect(
            writePasskeyCredential(new Uint8Array(32), 'cred-1', {}),
        ).rejects.toThrow('native provider only')
    })
})
