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

// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { AccountTypes, type WalletAccount } from '@perawallet/wallet-core-accounts'
import { serializeAccountForBackup } from '../serializeAccountForBackup'

const algo25: WalletAccount = {
    id: '1', type: AccountTypes.algo25, address: 'ADDR', keyPairId: 'kp-1', name: 'Main',
}

describe('serializeAccountForBackup', () => {
    it('reveals the Algo25 mnemonic via withSecret and emits address + secrets', async () => {
        const withSecret = vi.fn(async (_id: string, fn: (b: Uint8Array) => unknown) =>
            fn(new Uint8Array(32).fill(9)),
        )
        const toMnemonic = vi.fn(() => 'word-a word-b')
        const result = await serializeAccountForBackup(algo25, {
            updatedAt: 5,
            withSecret: withSecret as never,
            algo25SecretKeyToMnemonic: toMnemonic as never,
        })
        expect(withSecret).toHaveBeenCalledWith('kp-1', expect.any(Function))
        expect(result?.address.key).toBe('accounts/ADDR')
        expect(result?.secrets?.payload).toMatchObject({ type: 'Algo25', mnemonic: 'word-a word-b' })
    })

    it('returns address-only for a watch account (no secret reveal)', async () => {
        const withSecret = vi.fn()
        const watch: WalletAccount = { id: '2', type: AccountTypes.watch, address: 'W', name: 'Watcher' }
        const result = await serializeAccountForBackup(watch, {
            updatedAt: 1, withSecret: withSecret as never, algo25SecretKeyToMnemonic: (() => '') as never,
        })
        expect(withSecret).not.toHaveBeenCalled()
        expect(result?.secrets).toBeNull()
    })

    it('serializes an HD account into an HdKey item + a HdSeed secret extra item', async () => {
        const resolveHd = vi.fn(async () => ({
            seedFirstDerivedAddress: 'FIRST',
            publicKeyHex: 'aabb',
            seedHex: 'aa'.repeat(96),
            entropyHex: 'bb'.repeat(32),
        }))
        const hd: WalletAccount = {
            id: '3',
            type: AccountTypes.hdWallet,
            address: 'CHILD',
            keyPairId: 'kp',
            name: 'Child',
            hdWalletDetails: { account: 0, change: 0, keyIndex: 1, derivationType: 9 },
        }
        const result = await serializeAccountForBackup(hd, {
            updatedAt: 7,
            withSecret: vi.fn() as never,
            algo25SecretKeyToMnemonic: (() => '') as never,
            resolveHd: resolveHd as never,
        })
        expect(resolveHd).toHaveBeenCalledWith(hd)
        expect(result?.address.key).toBe('accounts/CHILD')
        expect(result?.secrets).toBeNull()
        expect(result?.extraItems?.[0].key).toBe('secrets/FIRST')
        expect(result?.extraItems?.[0].payload).toMatchObject({
            type: 'HdSeed',
            seed: 'aa'.repeat(96),
            entropy: 'bb'.repeat(32),
        })
    })

    it('returns null for an HD account when no resolveHd is provided', async () => {
        const hd: WalletAccount = {
            id: '3',
            type: AccountTypes.hdWallet,
            address: 'CHILD',
            keyPairId: 'kp',
            hdWalletDetails: { account: 0, change: 0, keyIndex: 0, derivationType: 9 },
        }
        const result = await serializeAccountForBackup(hd, {
            updatedAt: 1,
            withSecret: vi.fn() as never,
            algo25SecretKeyToMnemonic: (() => '') as never,
        })
        expect(result).toBeNull()
    })
})
