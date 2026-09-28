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
import { describe, test, expect } from 'vitest'
import { prepareHDMasterKey } from '../prepare-hd-master-key'
import { mnemonicWordsToIndices } from '../mnemonic-indices'

const USER_MNEMONIC =
    'achieve plunge scare have music possible will garden expect kangaroo impulse deny obvious inhale expand process betray voice crash insane electric mean test rude'
const USER_MNEMONIC_INDICES = mnemonicWordsToIndices(USER_MNEMONIC.split(' '))!

describe('prepareHDMasterKey', () => {
    test('returns rootKey (96B), entropy (32B), and a stable id when indices provided', async () => {
        const result = await prepareHDMasterKey({
            mnemonicIndices: USER_MNEMONIC_INDICES,
        })
        expect(result.rootKey.byteLength).toBe(96)
        expect(result.entropy.byteLength).toBe(32)
        expect(typeof result.keyId).toBe('string')
        expect(result.keyId.length).toBeGreaterThan(0)
    })

    test('uses the supplied id when given', async () => {
        const result = await prepareHDMasterKey({
            mnemonicIndices: USER_MNEMONIC_INDICES,
            id: 'fixed-id-123',
        })
        expect(result.keyId).toBe('fixed-id-123')
    })

    test('generates fresh entropy on each call when no mnemonic provided', async () => {
        const a = await prepareHDMasterKey()
        const b = await prepareHDMasterKey()
        expect(a.entropy.byteLength).toBe(32)
        expect(b.entropy.byteLength).toBe(32)
        const aHex = Array.from(a.entropy)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('')
        const bHex = Array.from(b.entropy)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('')
        expect(aHex).not.toBe(bHex)
    })
})
