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
import { describe, expect, it, vi } from 'vitest'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { serializeAccountForBackup } from '../serializeAccountForBackup'

const algo25: WalletAccount = {
    id: '1',
    type: AccountTypes.algo25,
    address: 'ADDR',
    keyPairId: 'kp-1',
    name: 'Main',
}

const quantum: WalletAccount = {
    id: '4',
    type: AccountTypes.quantum,
    address: 'QADDR',
    keyPairId: 'kp-q',
    name: 'PQ',
}

describe('serializeAccountForBackup', () => {
    it('resolves the algo25 mnemonic through the injected resolver and emits address + secrets', async () => {
        const resolveMnemonic = vi.fn(async () => 'word-a word-b')

        const result = await serializeAccountForBackup(algo25, {
            updatedAt: 5,
            resolveMnemonic,
        })

        expect(resolveMnemonic).toHaveBeenCalledWith(algo25)
        expect(result?.address.key).toBe('accounts/ADDR')
        expect(result?.secrets?.payload).toMatchObject({
            type: 'algo25',
            mnemonic: 'word-a word-b',
        })
    })

    it('backs up a quantum account through the same 25-word resolver', async () => {
        const resolveMnemonic = vi.fn(async () => 'q1 q2')

        const result = await serializeAccountForBackup(quantum, {
            updatedAt: 5,
            resolveMnemonic,
        })

        expect(resolveMnemonic).toHaveBeenCalledWith(quantum)
        expect(result?.address.payload).toMatchObject({ type: 'quantum' })
        expect(result?.secrets?.payload).toMatchObject({
            type: 'quantum',
            mnemonic: 'q1 q2',
        })
    })

    it('skips a secret-bearing account when the mnemonic cannot be resolved', async () => {
        const resolveMnemonic = vi.fn(async () => null)

        const result = await serializeAccountForBackup(algo25, {
            updatedAt: 5,
            resolveMnemonic,
        })

        expect(result).toBeNull()
    })

    it('skips a secret-bearing account when no resolver is injected', async () => {
        const result = await serializeAccountForBackup(algo25, { updatedAt: 5 })

        expect(result).toBeNull()
    })

    it('returns address-only for a watch account (no secret reveal)', async () => {
        const resolveMnemonic = vi.fn()
        const watch: WalletAccount = {
            id: '2',
            type: AccountTypes.watch,
            address: 'W',
            name: 'Watcher',
        }

        const result = await serializeAccountForBackup(watch, {
            updatedAt: 1,
            resolveMnemonic: resolveMnemonic as never,
        })

        expect(resolveMnemonic).not.toHaveBeenCalled()
        expect(result?.secrets).toBeNull()
    })

    it('serializes an HD account into an hdWallet item + a hdSeed secret extra item', async () => {
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
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 1,
                derivationType: 9,
            },
        }

        const result = await serializeAccountForBackup(hd, {
            updatedAt: 7,
            resolveHd: resolveHd as never,
        })

        expect(resolveHd).toHaveBeenCalledWith(hd)
        expect(result?.address.key).toBe('accounts/CHILD')
        expect(result?.secrets).toBeNull()
        expect(result?.extraItems?.[0].key).toBe('secrets/FIRST')
        expect(result?.extraItems?.[0].payload).toMatchObject({
            type: 'hdSeed',
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
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }

        const result = await serializeAccountForBackup(hd, { updatedAt: 1 })

        expect(result).toBeNull()
    })
})
