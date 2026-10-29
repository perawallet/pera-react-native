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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAccount } from '@perawallet/wallet-core-accounts'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { accountRecordItemKey, secretsItemKey } from '../../models'
import { serializeAccountForBackup } from '../serializeAccountForBackup'
import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import {
    registerAlgorandAccountsAdapter,
    registerEthereumAccountsAdapter,
    registerBaseBackupChain,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'

registerAlgorandAccountsAdapter()
registerEthereumAccountsAdapter()

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const KEY_HEX =
    '0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20'
const keyBytes = () =>
    Uint8Array.from(KEY_HEX.match(/../g) ?? [], byte =>
        Number.parseInt(byte, 16),
    )

const deps = {
    chainId: 'algorand' as const,
    updatedAt: 3,
    hashAddress,
}

const algo25 = buildAccount({
    id: 'algo25',
    name: 'Main',
    custody: { kind: 'local', seed: null },
    chainId: 'algorand',
    chains: { algorand: { address: 'ALGO', keyPairId: 'algo-key' } },
})
const hd = buildAccount({
    id: 'hd',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 1 } },
    chainId: 'algorand',
    chains: {
        algorand: { address: 'CHILD', keyPairId: 'hd-key' },
        ethereum: { address: '0xchild', keyPairId: 'eth-key' },
    },
})
const privateKeyAccount = buildAccount({
    id: 'key',
    name: 'Imported',
    custody: { kind: 'local', seed: null },
    chainId: 'ethereum',
    chains: { ethereum: { address: '0xkey', keyPairId: 'eth-raw' } },
})
const watch = buildAccount({
    id: 'watch',
    custody: { kind: 'watch' },
    chainId: 'algorand',
    chains: { algorand: { address: 'W' } },
})

const resolveHd = vi.fn(async () => ({
    seedFirstDerivedAddress: 'SEED',
    publicKeyHex: 'aabb',
    seedHex: 'ccdd',
    entropyHex: 'eeff',
}))

describe('serializeAccountForBackup', () => {
    beforeEach(() => {
        registerFakeBackupAdapter()
        registerEthereumBackupChain()
        resolveHd.mockClear()
    })

    it('files a single-key account as a record beside its recovery phrase', async () => {
        const serialized = await serializeAccountForBackup(algo25, {
            ...deps,
            resolveMnemonic: async () => 'w1 w2',
        })

        expect(serialized?.record.key).toBe(
            accountRecordItemKey(hashAddress('ALGO')),
        )
        expect(serialized?.secrets).toEqual({
            key: secretsItemKey(hashAddress('ALGO')),
            type: 'ACCOUNT',
            payload: { type: 'algo25', mnemonic: 'w1 w2', address: 'ALGO' },
        })
    })

    it('skips a single-key account whose phrase it cannot read', async () => {
        expect(
            await serializeAccountForBackup(algo25, {
                ...deps,
                resolveMnemonic: async () => null,
            }),
        ).toBeNull()
    })

    it('files an HD account under its seed position, with the seed beside it', async () => {
        const serialized = await serializeAccountForBackup(hd, {
            ...deps,
            resolveHd,
        })

        expect(serialized?.record.key).toBe(
            accountRecordItemKey(hashAddress('SEED/0/1')),
        )
        expect(serialized?.secrets).toBeNull()
        expect(serialized?.extraItems).toEqual([
            {
                key: secretsItemKey(hashAddress('SEED')),
                type: 'ACCOUNT',
                payload: {
                    type: 'hdSeed',
                    seed: 'ccdd',
                    entropy: 'eeff',
                    address: 'SEED',
                },
            },
        ])
    })

    it("hands the sync's seed cache to the resolver", async () => {
        const seedSecrets = new Map()

        await serializeAccountForBackup(hd, { ...deps, resolveHd, seedSecrets })

        expect(resolveHd).toHaveBeenCalledWith(hd, seedSecrets)
    })

    it('reads no seed for an account on no chain this build backs up', async () => {
        getProvider().chains.reset()

        expect(
            await serializeAccountForBackup(hd, { ...deps, resolveHd }),
        ).toBeNull()
        expect(resolveHd).not.toHaveBeenCalled()
    })

    it('files a raw private key as a secret, hex, and zeroes the bytes', async () => {
        const bytes = keyBytes()
        const serialized = await serializeAccountForBackup(privateKeyAccount, {
            ...deps,
            resolvePrivateKey: async () => bytes,
        })

        expect(serialized?.record.key).toBe(
            accountRecordItemKey(hashAddress('0xkey')),
        )
        expect(serialized?.secrets?.payload).toEqual({
            type: 'standaloneKey',
            chain: 'ethereum',
            address: '0xkey',
            privateKey: KEY_HEX,
        })
        expect(bytes.every(byte => byte === 0)).toBe(true)
    })

    it('files one secret for a key enabled on two chains, under the first chain in record order', async () => {
        registerBaseBackupChain()
        const resolvePrivateKey = vi.fn(async () => keyBytes())
        const twoChains = buildAccount({
            id: 'key',
            custody: { kind: 'local', seed: null },
            chainId: 'ethereum',
            chains: {
                ethereum: { address: '0xkey', keyPairId: 'eth-raw' },
                base: { address: '0xkey', keyPairId: 'eth-raw' },
            },
        })

        const serialized = await serializeAccountForBackup(twoChains, {
            ...deps,
            resolvePrivateKey,
        })

        expect(resolvePrivateKey).toHaveBeenCalledExactlyOnceWith(
            'base',
            'eth-raw',
        )
        expect(serialized?.secrets?.payload).toEqual({
            type: 'standaloneKey',
            chain: 'base',
            address: '0xkey',
            privateKey: KEY_HEX,
        })
        expect(serialized?.record.payload.chains.map(c => c.chain)).toEqual([
            'base',
            'ethereum',
        ])
    })

    it('reads no key for a private-key account on no chain this build backs up', async () => {
        getProvider().chains.reset()
        const resolvePrivateKey = vi.fn(async () => keyBytes())

        expect(
            await serializeAccountForBackup(privateKeyAccount, {
                ...deps,
                resolvePrivateKey,
            }),
        ).toBeNull()
        expect(resolvePrivateKey).not.toHaveBeenCalled()
    })

    it('skips a private-key account whose key it cannot read', async () => {
        expect(
            await serializeAccountForBackup(privateKeyAccount, {
                ...deps,
                resolvePrivateKey: async () => null,
            }),
        ).toBeNull()
    })

    it('files a watch account as a record with no secret', async () => {
        const serialized = await serializeAccountForBackup(watch, deps)

        expect(serialized?.secrets).toBeNull()
        expect(serialized?.record.key).toBe(
            accountRecordItemKey(hashAddress('W')),
        )
    })
})
