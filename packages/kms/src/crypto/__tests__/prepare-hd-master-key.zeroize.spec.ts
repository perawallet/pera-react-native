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
import { describe, test, expect, vi, beforeEach } from 'vitest'

const seed = new Uint8Array(64).fill(7)
const entropy = new Uint8Array(32).fill(9)

vi.mock('../hdwallet-utils', () => ({
    generateHDMasterKey: vi.fn(async () => ({ seed, entropy })),
}))

const fromSeedMock = vi.fn()
vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    fromSeed: (...args: unknown[]) => fromSeedMock(...args),
}))

import { prepareHDMasterKey } from '../prepare-hd-master-key'

describe('prepareHDMasterKey seed zeroization', () => {
    beforeEach(() => {
        seed.fill(7)
        fromSeedMock.mockReset()
    })

    test('wipes the BIP39 seed even when fromSeed throws', async () => {
        fromSeedMock.mockImplementation(() => {
            throw new Error('derivation failed')
        })
        await expect(prepareHDMasterKey()).rejects.toThrow('derivation failed')
        expect(Array.from(seed)).toEqual(Array.from(new Uint8Array(64)))
    })
})
