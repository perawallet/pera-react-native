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
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { accountItemKey, secretsItemKey } from '../../models'
import { serializeAccountForBackup } from '../serializeAccountForBackup'
import {
    HARDHAT_0_ADDRESS,
    HARDHAT_0_KEY_HEX,
    registerEthereumAccountsAdapter,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'
import { hexToBytes } from '@perawallet/wallet-core-kms'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const algo25: WalletAccount = {
    id: '1',
    custody: { kind: 'local', seed: null },
    address: 'ADDR',
    keyPairId: 'kp-1',
    name: 'Main',
}

const quantum: WalletAccount = {
    id: '4',
    custody: { kind: 'local', seed: 'quantum' },
    address: 'QADDR',
    keyPairId: 'kp-q',
    name: 'PQ',
}

describe('serializeAccountForBackup', () => {
    it('resolves the algo25 mnemonic through the injected resolver and emits address + secrets', async () => {
        const resolveMnemonic = vi.fn(async () => 'word-a word-b')

        const result = await serializeAccountForBackup(algo25, {
            updatedAt: 5,
            hashAddress,
            resolveMnemonic,
        })

        expect(resolveMnemonic).toHaveBeenCalledWith(algo25)
        expect(result?.address.key).toBe(accountItemKey(hashAddress('ADDR')))
        expect(result?.secrets?.payload).toMatchObject({
            type: 'algo25',
            mnemonic: 'word-a word-b',
            address: 'ADDR',
        })
    })

    it('backs up a quantum account through the same 25-word resolver', async () => {
        const resolveMnemonic = vi.fn(async () => 'q1 q2')

        const result = await serializeAccountForBackup(quantum, {
            updatedAt: 5,
            hashAddress,
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
            hashAddress,
            resolveMnemonic,
        })

        expect(result).toBeNull()
    })

    it('skips a secret-bearing account when no resolver is injected', async () => {
        const result = await serializeAccountForBackup(algo25, {
            updatedAt: 5,
            hashAddress,
        })

        expect(result).toBeNull()
    })

    it('returns address-only for a watch account (no secret reveal)', async () => {
        const resolveMnemonic = vi.fn()
        const watch: WalletAccount = {
            id: '2',
            custody: { kind: 'watch' },
            address: 'W',
            name: 'Watcher',
        }

        const result = await serializeAccountForBackup(watch, {
            updatedAt: 1,
            hashAddress,
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
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 1 },
            },
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
            hashAddress,
            resolveHd: resolveHd as never,
        })

        expect(resolveHd).toHaveBeenCalledWith(hd)
        expect(result?.address.key).toBe(accountItemKey(hashAddress('CHILD')))
        expect(result?.secrets).toBeNull()
        expect(result?.extraItems?.[0].key).toBe(
            secretsItemKey(hashAddress('FIRST')),
        )
        expect(result?.extraItems?.[0].payload).toMatchObject({
            type: 'hdSeed',
            seed: 'aa'.repeat(96),
            entropy: 'bb'.repeat(32),
            address: 'FIRST',
        })
    })

    it('returns null for an HD account when no resolveHd is provided', async () => {
        const hd: WalletAccount = {
            id: '3',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'CHILD',
            keyPairId: 'kp',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }

        const result = await serializeAccountForBackup(hd, {
            updatedAt: 1,
            hashAddress,
        })

        expect(result).toBeNull()
    })
})

describe('serializeAccountForBackup on another chain', () => {
    const resolved = {
        seedFirstDerivedAddress: 'FIRST',
        publicKeyHex: 'aabb',
        seedHex: 'aa'.repeat(96),
        entropyHex: 'bb'.repeat(32),
    }
    const hdCustody = {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 1 },
    } as const

    const algorandHd = {
        id: 'hd',
        name: 'Child',
        custody: hdCustody,
        address: 'CHILD',
        keyPairId: 'kp-a',
        hdWalletDetails: {
            account: 0,
            change: 0,
            keyIndex: 1,
            derivationType: 9,
        },
        chains: {
            algorand: { address: 'CHILD', keyPairId: 'kp-a' },
            ethereum: { address: '0xeth', keyPairId: 'kp-e' },
        },
    } as unknown as WalletAccount

    const ethereumOnlyHd = {
        id: 'hd-eth',
        name: 'Eth child',
        custody: hdCustody,
        address: '0xeth',
        keyPairId: 'kp-e',
        chains: { ethereum: { address: '0xeth', keyPairId: 'kp-e' } },
    } as unknown as WalletAccount

    const privateKeyAccount = {
        id: 'pk',
        name: 'Imported',
        custody: { kind: 'local', seed: null },
        address: HARDHAT_0_ADDRESS,
        keyPairId: 'raw-key',
        chains: {
            ethereum: { address: HARDHAT_0_ADDRESS, keyPairId: 'raw-key' },
        },
    } as unknown as WalletAccount

    const deps = { updatedAt: 3, hashAddress }

    beforeEach(() => {
        registerEthereumBackupChain()
        registerEthereumAccountsAdapter()
    })

    it('serializes an HD account on two chains to hdWallet + hdChain and exactly one seed', async () => {
        const result = await serializeAccountForBackup(algorandHd, {
            ...deps,
            resolveHd: async () => resolved,
        })

        expect(result?.address.payload).toMatchObject({ type: 'hdWallet' })
        const items = [
            result?.address,
            result?.secrets,
            ...(result?.extraItems ?? []),
        ].filter(Boolean)
        expect(items.map(item => item?.payload.type)).toEqual([
            'hdWallet',
            'hdSeed',
            'hdChain',
        ])
        expect(result?.extraItems?.[1]).toMatchObject({
            key: accountItemKey(hashAddress('0xeth')),
            payload: {
                chain: 'ethereum',
                address: '0xeth',
                seedFirstDerivedAddress: 'FIRST',
                account: 0,
                keyIndex: 1,
            },
        })
    })

    it('leads with the hdChain item when the account has no legacy entry, and writes no hdWallet item', async () => {
        const resolveHd = vi.fn(async () => ({
            ...resolved,
            publicKeyHex: null,
        }))

        const result = await serializeAccountForBackup(ethereumOnlyHd, {
            ...deps,
            resolveHd,
        })

        expect(result?.address.payload).toMatchObject({
            type: 'hdChain',
            address: '0xeth',
        })
        expect(result?.extraItems?.map(item => item.payload.type)).toEqual([
            'hdSeed',
        ])
    })

    it('does not read the seed for an account on a chain this build cannot back up', async () => {
        const resolveHd = vi.fn(async () => resolved)
        const unknown = {
            ...ethereumOnlyHd,
            chains: { 'fixture-chain': { address: 'fx', keyPairId: 'k' } },
        } as unknown as WalletAccount

        const result = await serializeAccountForBackup(unknown, {
            ...deps,
            resolveHd,
        })

        expect(result).toBeNull()
        expect(resolveHd).not.toHaveBeenCalled()
    })

    it('writes the private key of an imported account as hex under its own address', async () => {
        const result = await serializeAccountForBackup(privateKeyAccount, {
            ...deps,
            resolvePrivateKey: async () => hexToBytes(HARDHAT_0_KEY_HEX),
        })

        expect(result?.address).toMatchObject({
            key: accountItemKey(hashAddress(HARDHAT_0_ADDRESS)),
            payload: {
                type: 'standaloneKey',
                chain: 'ethereum',
                address: HARDHAT_0_ADDRESS,
                customName: 'Imported',
            },
        })
        expect(result?.secrets).toMatchObject({
            key: secretsItemKey(hashAddress(HARDHAT_0_ADDRESS)),
            payload: {
                type: 'standaloneKey',
                chain: 'ethereum',
                address: HARDHAT_0_ADDRESS,
                privateKey: HARDHAT_0_KEY_HEX,
            },
        })
    })

    it('asks the resolver for the entry key on its own chain', async () => {
        const resolvePrivateKey = vi.fn(async () =>
            hexToBytes(HARDHAT_0_KEY_HEX),
        )

        await serializeAccountForBackup(privateKeyAccount, {
            ...deps,
            resolvePrivateKey,
        })

        expect(resolvePrivateKey).toHaveBeenCalledWith('ethereum', 'raw-key')
    })

    it('zeroes the key bytes the resolver returned', async () => {
        const keyBytes = hexToBytes(HARDHAT_0_KEY_HEX)

        await serializeAccountForBackup(privateKeyAccount, {
            ...deps,
            resolvePrivateKey: async () => keyBytes,
        })

        expect(keyBytes).toHaveLength(32)
        expect(keyBytes.every(byte => byte === 0)).toBe(true)
    })

    it('zeroes the key bytes when hashing the address throws after the read', async () => {
        const keyBytes = hexToBytes(HARDHAT_0_KEY_HEX)

        await expect(
            serializeAccountForBackup(privateKeyAccount, {
                updatedAt: 3,
                hashAddress: () => {
                    throw new Error('hash failed')
                },
                resolvePrivateKey: async () => keyBytes,
            }),
        ).rejects.toThrow('hash failed')

        expect(keyBytes.every(byte => byte === 0)).toBe(true)
    })

    it('skips a private-key account when the resolver is missing or has no key', async () => {
        expect(
            await serializeAccountForBackup(privateKeyAccount, deps),
        ).toBeNull()
        expect(
            await serializeAccountForBackup(privateKeyAccount, {
                ...deps,
                resolvePrivateKey: async () => null,
            }),
        ).toBeNull()
    })

    it('emits nothing for a private-key account on a chain this build cannot back up', async () => {
        const resolvePrivateKey = vi.fn(async () =>
            hexToBytes(HARDHAT_0_KEY_HEX),
        )
        const unknown = {
            ...privateKeyAccount,
            chains: { 'fixture-chain': { address: 'fx', keyPairId: 'k' } },
        } as unknown as WalletAccount

        expect(
            await serializeAccountForBackup(unknown, {
                ...deps,
                resolvePrivateKey,
            }),
        ).toBeNull()
        expect(resolvePrivateKey).not.toHaveBeenCalled()
    })

    it('adds a watchChain item beside the legacy watch item', async () => {
        const watch = {
            id: 'w',
            custody: { kind: 'watch' },
            address: 'W',
            chains: {
                algorand: { address: 'W' },
                ethereum: { address: '0xwatch' },
            },
        } as unknown as WalletAccount

        const result = await serializeAccountForBackup(watch, deps)

        expect(result?.address.payload).toMatchObject({ type: 'watch' })
        expect(result?.extraItems?.map(item => item.payload)).toEqual([
            expect.objectContaining({
                type: 'watchChain',
                chain: 'ethereum',
                address: '0xwatch',
            }),
        ])
    })

    it('leads with the watchChain item for a watch account on Ethereum alone', async () => {
        const watch = {
            id: 'w',
            custody: { kind: 'watch' },
            address: '0xwatch',
            chains: { ethereum: { address: '0xwatch' } },
        } as unknown as WalletAccount

        const result = await serializeAccountForBackup(watch, deps)

        expect(result?.address.payload).toMatchObject({ type: 'watchChain' })
        expect(result?.extraItems).toBeUndefined()
    })
})
