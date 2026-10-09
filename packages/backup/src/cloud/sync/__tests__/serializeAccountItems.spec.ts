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

import { beforeEach, describe, expect, it } from 'vitest'
import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainDescriptor } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    parseAddressPayload,
    parseSecretsPayload,
} from '../../api/payloadParsers'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import { accountItemKey, secretsItemKey } from '../../models'
import {
    accountAddressesOf,
    backupChainEntriesOf,
    serializeAccountItems,
    serializeChainEntryItem,
} from '../serializeAccountItems'
import { canonicalJson } from '../canonicalize'
import {
    registerEthereumAccountsAdapter,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const algo25: WalletAccount = {
    id: '1',
    custody: { kind: 'local', seed: null },
    address: 'ADDR',
    keyPairId: 'seed-1-ed25519',
    name: 'Main',
}

describe('serializeAccountItems', () => {
    it('serializes an algo25 account to address + secrets items that round-trip', () => {
        const result = serializeAccountItems(algo25, {
            updatedAt: 1719300000000,
            secrets: {
                type: 'algo25',
                mnemonic: 'word1 word2',
                address: 'ADDR',
            },
            hashAddress,
        })
        expect(result).not.toBeNull()
        expect(result?.address.key).toBe(accountItemKey(hashAddress('ADDR')))
        expect(result?.secrets?.key).toBe(secretsItemKey(hashAddress('ADDR')))
        expect(
            parseAddressPayload(canonicalJson(result!.address.payload)),
        ).toMatchObject({
            type: 'algo25',
            address: 'ADDR',
            customName: 'Main',
            updatedAt: 1719300000000,
        })
        expect(
            parseSecretsPayload(canonicalJson(result!.secrets!.payload)),
        ).toMatchObject({
            type: 'algo25',
            mnemonic: 'word1 word2',
            address: 'ADDR',
        })
    })

    it('serializes a watch account to an address-only item (no secrets)', () => {
        const watch: WalletAccount = {
            id: '2',
            custody: { kind: 'watch' },
            address: 'WADDR',
            name: 'Watcher',
        }
        const result = serializeAccountItems(watch, {
            updatedAt: 1,
            secrets: null,
            hashAddress,
        })
        expect(result?.address.key).toBe(accountItemKey(hashAddress('WADDR')))
        expect(result?.secrets).toBeNull()
        expect(
            parseAddressPayload(canonicalJson(result!.address.payload)),
        ).toMatchObject({
            type: 'watch',
            address: 'WADDR',
            customName: 'Watcher',
        })
    })

    it('returns null for HD accounts when no hd context is provided', () => {
        const hd: WalletAccount = {
            id: '3',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'HADDR',
            keyPairId: 'k',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }
        expect(
            serializeAccountItems(hd, {
                updatedAt: 1,
                secrets: null,
                hashAddress,
            }),
        ).toBeNull()
    })

    it('builds an hdWallet address payload from the injected hd context (no personal secret)', () => {
        const hd: WalletAccount = {
            id: '3',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 1 },
            },
            address: 'CHILD',
            keyPairId: 'seed-1-acc0-idx1-dt9',
            name: 'Child 1',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 1,
                derivationType: 9,
            },
        }
        const result = serializeAccountItems(hd, {
            updatedAt: 1719300000000,
            secrets: null,
            hashAddress,
            hd: { seedFirstDerivedAddress: 'FIRST', publicKeyHex: 'aabb' },
        })
        expect(result?.address.key).toBe(accountItemKey(hashAddress('CHILD')))
        expect(result?.secrets).toBeNull()
        expect(result?.address.payload).toMatchObject({
            type: 'hdWallet',
            address: 'CHILD',
            seedFirstDerivedAddress: 'FIRST',
            publicKey: 'aabb',
            account: 0,
            change: 0,
            keyIndex: 1,
            derivationType: 9,
            customName: 'Child 1',
            updatedAt: 1719300000000,
        })
    })

    it('has no item for a standalone account whose secret is a private key', () => {
        getProvider().chains.reset()
        getProvider().chains.register({
            id: 'ethereum',
            signing: {
                schemes: ['secp256k1'],
                derivationPaths: {},
                rawKeySchemes: ['secp256k1'],
                standaloneSecret: 'privateKey',
            },
        } as unknown as ChainDescriptor)
        const imported = {
            id: '3',
            custody: { kind: 'local', seed: null },
            address: '0xabc',
            chains: { ethereum: { address: '0xabc', keyPairId: 'raw-key' } },
        } as unknown as WalletAccount

        expect(
            serializeAccountItems(imported, {
                updatedAt: 1,
                secrets: null,
                hashAddress,
            }),
        ).toBeNull()
    })
})

describe('chain entries', () => {
    const ETH = (address: string) => ({ ethereum: { address } })

    const withEntries = (
        base: Partial<WalletAccount>,
        chains: Record<string, { address: string; keyPairId?: string }>,
    ): WalletAccount => ({ id: 'a', ...base, chains }) as WalletAccount

    const hdAccount = withEntries(
        {
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 2, keyIndex: 5 },
            },
            name: 'Child',
            address: 'ALGO',
        },
        {
            algorand: { address: 'ALGO', keyPairId: 'k1' },
            ethereum: { address: '0xeth', keyPairId: 'k2' },
        },
    )

    beforeEach(() => {
        registerEthereumBackupChain()
        registerEthereumAccountsAdapter()
    })

    describe('backupChainEntriesOf', () => {
        it('drops the legacy entry and sorts by chain id', () => {
            const account = withEntries(
                {},
                {
                    ...ETH('0xeth'),
                    algorand: { address: 'ALGO' },
                },
            )

            expect(backupChainEntriesOf(account)).toEqual([
                { chainId: 'ethereum', entry: { address: '0xeth' } },
            ])
        })

        it('drops a chain this build cannot back up', () => {
            const account = withEntries(
                {},
                {
                    ...ETH('0xeth'),
                    'fixture-chain': { address: 'fx' },
                },
            )

            expect(
                backupChainEntriesOf(account).map(({ chainId }) => chainId),
            ).toEqual(['ethereum'])
        })

        it('drops a chain whose cloud backup capability is off', () => {
            getProvider().chains.reset()
            getProvider().chains.register(
                {
                    id: 'ethereum',
                    signing: { schemes: [], derivationPaths: {} },
                } as unknown as ChainDescriptor,
                { cloudBackup: false } as never,
            )

            expect(backupChainEntriesOf(withEntries({}, ETH('0xeth')))).toEqual(
                [],
            )
        })

        it('is empty for a legacy record with no chains', () => {
            expect(backupChainEntriesOf(algo25)).toEqual([])
        })
    })

    describe('serializeChainEntryItem', () => {
        const params = {
            updatedAt: 9,
            hashAddress,
            seedFirstDerivedAddress: 'SEED',
        }
        const entry = {
            chainId: 'ethereum',
            entry: { address: '0xeth' },
        } as const

        it('files an hdChain item under the entry address with the seed position', () => {
            const item = serializeChainEntryItem(hdAccount, entry, params)

            expect(item?.key).toBe(accountItemKey(hashAddress('0xeth')))
            expect(item?.payload).toEqual({
                type: 'hdChain',
                chain: 'ethereum',
                address: '0xeth',
                seedFirstDerivedAddress: 'SEED',
                account: 2,
                keyIndex: 5,
                customName: 'Child',
                updatedAt: 9,
            })
        })

        it('has no hdChain item without a seed reference', () => {
            expect(
                serializeChainEntryItem(hdAccount, entry, {
                    updatedAt: 9,
                    hashAddress,
                }),
            ).toBeNull()
        })

        it('maps a private-key account to a standaloneKey item', () => {
            const account = withEntries(
                { custody: { kind: 'local', seed: null } },
                ETH('0xeth'),
            )

            expect(
                serializeChainEntryItem(account, entry, params)?.payload,
            ).toMatchObject({ type: 'standaloneKey', chain: 'ethereum' })
        })

        it('maps a watch account to a watchChain item', () => {
            const account = withEntries(
                { custody: { kind: 'watch' }, name: 'Eye' },
                ETH('0xeth'),
            )

            expect(
                serializeChainEntryItem(account, entry, params)?.payload,
            ).toMatchObject({
                type: 'watchChain',
                chain: 'ethereum',
                customName: 'Eye',
            })
        })

        it.each([
            ['hardware', { kind: 'hardware' }],
            ['multisig', { kind: 'multisig' }],
            ['quantum', { kind: 'local', seed: 'quantum' }],
        ])('has no item for a %s account', (_label, custody) => {
            const account = withEntries({ custody } as never, ETH('0xeth'))

            expect(serializeChainEntryItem(account, entry, params)).toBeNull()
        })
    })

    describe('accountAddressesOf', () => {
        it('lists every chain address once', () => {
            expect(accountAddressesOf(hdAccount)).toEqual(['ALGO', '0xeth'])
        })

        it('answers with the address alone for a legacy record', () => {
            expect(accountAddressesOf(algo25)).toEqual(['ADDR'])
        })
    })

    it('has no legacy item for an account with no legacy-chain entry', () => {
        const ethereumOnly = withEntries(
            { custody: { kind: 'watch' }, address: '0xeth' },
            ETH('0xeth'),
        )

        expect(
            serializeAccountItems(ethereumOnly, {
                updatedAt: 1,
                secrets: null,
                hashAddress,
            }),
        ).toBeNull()
    })
})
