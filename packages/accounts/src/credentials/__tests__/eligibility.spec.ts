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

import { beforeEach, describe, test, expect } from 'vitest'
import {
    addressCodecs,
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    FIXTURE_CHAIN_ID,
    fixtureCodec,
} from '@perawallet/wallet-core-chain-contract/testing'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { HdIndex, WalletAccount } from '../../models'
import { testAccount } from '../../__tests__/accountFactory'
import {
    canDerive,
    canImportRawKey,
    findAddressHolder,
    findPathHolder,
    nextChainPosition,
    seedMintableScheme,
} from '../eligibility'

describe('wallet eligibility and holder lookups', () => {
    type Keys = NonNullable<Parameters<typeof canDerive>[3]>

    const keys = [
        { id: 'hd-seed', type: 'seed', metadata: { scheme: 'bip39' } },
        { id: 'local-seed', type: 'seed', metadata: { scheme: 'algo25' } },
        { id: 'explicit-seed', type: 'seed', metadata: { scheme: 'quantum' } },
        { id: 'hd-key', type: 'ed25519', metadata: { parentKeyId: 'hd-seed' } },
        {
            id: 'local-key',
            type: 'ed25519',
            metadata: { parentKeyId: 'local-seed' },
        },
        {
            id: 'explicit-key',
            type: 'falcon-1024',
            metadata: { parentKeyId: 'explicit-seed' },
        },
    ] as unknown as Keys

    const ALGORAND = 'algorand' as ChainId
    const ORIGIN: HdIndex = { account: 0, keyIndex: 0 }
    const fixtureAddress = 'fx' + 'ab'.repeat(20)

    const capabilities = (privateKeys: boolean): ChainCapabilities =>
        Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [
                capability,
                capability === 'privateKeys' && privateKeys,
            ]),
        ) as ChainCapabilities

    const register = (
        id: ChainId,
        signing: Partial<ChainDescriptor['signing']>,
        privateKeys = false,
    ) =>
        getProvider().chains.register(
            {
                id,
                signing: {
                    schemes: ['ed25519'],
                    derivationPaths: {},
                    rawKeySchemes: [],
                    ...signing,
                },
            } as unknown as ChainDescriptor,
            capabilities(privateKeys),
        )

    const path = (account: number, keyIndex: number) =>
        `m/44'/9999'/${account}'/0/${keyIndex}`

    let hd: WalletAccount
    let single: WalletAccount
    let accounts: WalletAccount[]

    beforeEach(() => {
        hd = testAccount('hd')
        single = testAccount('local')
        accounts = [
            hd,
            single,
            testAccount('explicit'),
            testAccount('hardware'),
        ]
        register(ALGORAND, {
            schemes: ['ed25519', 'falcon-1024'],
            derivationPaths: { ed25519: path },
            rawKeySchemes: ['ed25519'],
        })
        register(FIXTURE_CHAIN_ID, { derivationPaths: { ed25519: path } })
    })

    describe('canDerive', () => {
        test.each([
            ['HD wallet', 'hd-seed', true, true],
            ['single-key seed', 'local-seed', false, false],
            ['explicit-kind seed', 'explicit-seed', false, false],
            ['hardware device', 'device-1', false, false],
        ])('%s', (_kind, walletId, onAlgorand, onFixture) => {
            expect(canDerive(accounts, walletId, ALGORAND, keys)).toBe(
                onAlgorand,
            )
            expect(canDerive(accounts, walletId, FIXTURE_CHAIN_ID, keys)).toBe(
                onFixture,
            )
        })

        test('is false for a chain whose descriptor has no path builder', () => {
            getProvider().chains.reset()
            register(FIXTURE_CHAIN_ID, { derivationPaths: {} })

            expect(canDerive(accounts, 'hd-seed', FIXTURE_CHAIN_ID, keys)).toBe(
                false,
            )
        })

        test('is false for an unregistered chain', () => {
            expect(
                canDerive(accounts, 'hd-seed', 'ethereum' as ChainId, keys),
            ).toBe(false)
        })

        test('is false for an unknown wallet id', () => {
            expect(canDerive(accounts, 'missing', ALGORAND, keys)).toBe(false)
        })

        test('is false for a seed with no account behind it', () => {
            expect(canDerive([single], 'hd-seed', ALGORAND, keys)).toBe(false)
        })
    })

    describe('seedMintableScheme', () => {
        test('is the first scheme with a derivation path', () => {
            expect(seedMintableScheme(FIXTURE_CHAIN_ID)).toBe('ed25519')
            expect(seedMintableScheme(ALGORAND)).toBe('ed25519')
        })

        test('is undefined for an unregistered chain', () => {
            expect(seedMintableScheme('ethereum' as ChainId)).toBeUndefined()
        })

        test('is undefined for a chain with no derivation paths', () => {
            getProvider().chains.reset()
            register(FIXTURE_CHAIN_ID, { derivationPaths: {} })

            expect(seedMintableScheme(FIXTURE_CHAIN_ID)).toBeUndefined()
        })
    })

    describe('nextChainPosition', () => {
        const at = (
            account: number,
            keyIndex: number,
            withFixture: boolean,
        ) => {
            const base = testAccount('hd')
            return {
                ...base,
                id: `${account}-${keyIndex}`,
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account, keyIndex },
                },
                chains: withFixture
                    ? {
                          ...base.chains,
                          [FIXTURE_CHAIN_ID]: { address: fixtureAddress },
                      }
                    : base.chains,
            } as WalletAccount
        }

        test('returns the lowest position without the chain', () => {
            const wallet = [at(1, 0, false), at(0, 1, false), at(0, 0, true)]

            expect(
                nextChainPosition(wallet, 'hd-seed', FIXTURE_CHAIN_ID, keys),
            ).toEqual({ account: 0, keyIndex: 1 })
        })

        test('moves to the next account once every position has the chain', () => {
            const wallet = [at(1, 0, true), at(0, 0, true), at(0, 1, true)]

            expect(
                nextChainPosition(wallet, 'hd-seed', FIXTURE_CHAIN_ID, keys),
            ).toEqual({ account: 2, keyIndex: 0 })
        })

        test('ignores positions held by another wallet', () => {
            const other = {
                ...at(0, 0, false),
                chains: {
                    [ALGORAND]: { address: 'X', keyPairId: 'other-key' },
                },
            } as WalletAccount
            const otherKeys = [
                ...keys,
                {
                    id: 'hd-seed-2',
                    type: 'seed',
                    metadata: { scheme: 'bip39' },
                },
                {
                    id: 'other-key',
                    type: 'ed25519',
                    metadata: { parentKeyId: 'hd-seed-2' },
                },
            ] as unknown as Keys

            expect(
                nextChainPosition(
                    [other, at(0, 0, true)],
                    'hd-seed',
                    FIXTURE_CHAIN_ID,
                    otherKeys,
                ),
            ).toEqual({ account: 1, keyIndex: 0 })
        })

        test('starts at the origin when the wallet holds no position', () => {
            expect(
                nextChainPosition([], 'hd-seed', FIXTURE_CHAIN_ID, keys),
            ).toEqual({ account: 0, keyIndex: 0 })
        })
    })

    describe('canImportRawKey', () => {
        test.each([
            ['a raw-key scheme with privateKeys on', ['ed25519'], true, true],
            [
                'a raw-key scheme with privateKeys off',
                ['ed25519'],
                false,
                false,
            ],
            ['no raw-key scheme with privateKeys on', [], true, false],
        ] as const)('%s', (_name, rawKeySchemes, privateKeys, expected) => {
            getProvider().chains.reset()
            register(ALGORAND, { rawKeySchemes }, privateKeys)

            expect(canImportRawKey(ALGORAND)).toBe(expected)
        })

        test('is false for an unregistered chain', () => {
            expect(canImportRawKey('ethereum' as ChainId)).toBe(false)
        })
    })

    describe('findPathHolder', () => {
        test('returns the account at a path already used', () => {
            expect(findPathHolder(accounts, 'hd-seed', ORIGIN, keys)).toBe(hd)
        })

        test('is undefined for a path nothing uses', () => {
            expect(
                findPathHolder(
                    accounts,
                    'hd-seed',
                    { account: 0, keyIndex: 1 },
                    keys,
                ),
            ).toBeUndefined()
        })

        test('is undefined in a wallet that is not HD', () => {
            expect(
                findPathHolder(accounts, 'local-seed', ORIGIN, keys),
            ).toBeUndefined()
        })

        test('still holds the path once the account spans another chain', () => {
            const spanning = {
                ...hd,
                chains: {
                    ...hd.chains,
                    [FIXTURE_CHAIN_ID]: { address: fixtureAddress },
                },
            }

            expect(findPathHolder([spanning], 'hd-seed', ORIGIN, keys)).toBe(
                spanning,
            )
        })
    })

    describe('findAddressHolder', () => {
        const fixtureScope: ChainScope = {
            chainId: FIXTURE_CHAIN_ID,
            networkId: 'mainnet',
        }
        const algorandScope: ChainScope = {
            chainId: ALGORAND,
            networkId: 'mainnet',
        }
        let spanning: WalletAccount

        beforeEach(() => {
            addressCodecs.register(fixtureCodec)
            spanning = {
                ...hd,
                chains: {
                    ...hd.chains,
                    [FIXTURE_CHAIN_ID]: { address: fixtureAddress },
                },
            }
        })

        test('finds an address in the case its codec ignores', () => {
            expect(
                findAddressHolder(
                    [spanning],
                    fixtureScope,
                    fixtureAddress.toUpperCase(),
                ),
            ).toBe(spanning)
        })

        test('does not match the same address on another chain', () => {
            expect(
                findAddressHolder([spanning], algorandScope, fixtureAddress),
            ).toBeUndefined()
        })

        test('is undefined for an unknown address', () => {
            expect(
                findAddressHolder(
                    [spanning],
                    fixtureScope,
                    'fx' + '00'.repeat(20),
                ),
            ).toBeUndefined()
        })

        test('finds a watch account by its address', () => {
            const watch = testAccount('watch', 'WATCH-ADDR')

            expect(
                findAddressHolder([hd, watch], algorandScope, 'WATCH-ADDR'),
            ).toBe(watch)
        })
    })
})
