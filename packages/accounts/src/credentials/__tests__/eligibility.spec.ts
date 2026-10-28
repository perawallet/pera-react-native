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

import { beforeEach, describe, test, expect, vi } from 'vitest'
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
import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '../../chain-adapter'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
} from '../../__tests__/accountFactory'
import {
    ALGORAND_ADDRESS,
    BASE,
    ETHEREUM,
    EVM_CHAINS,
    EVM_KEY_ADDRESS,
    POLYGON,
    registerChainFamilies,
} from '../../__tests__/chainFamilies'
import {
    canDerive,
    defaultChains,
    eligibleChains,
    eligibleChainsInFamily,
    canImportRawKey,
    findAddressHolder,
    findHardwareHolder,
    findPathHolder,
    hardwareJoinCandidates,
    hdDiscoveryChains,
    isEnabledByDefault,
    nextChainPosition,
    preferDefaultChain,
    seedMintableScheme,
} from '../eligibility'

const ledgerApps = vi.hoisted(() => new Set<string>())

vi.mock('@perawallet/wallet-core-hardware-wallet', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-hardware-wallet')
    >()),
    hasLedgerAppDriver: (chainId: string) => ledgerApps.has(chainId),
}))

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

        test('is true for a held bip39 seed with no account behind it', () => {
            expect(canDerive([single], 'hd-seed', ALGORAND, keys)).toBe(true)
        })

        test('is false for a held raw or Falcon seed with no account behind it', () => {
            expect(canDerive([], 'local-seed', ALGORAND, keys)).toBe(false)
            expect(canDerive([], 'explicit-seed', ALGORAND, keys)).toBe(false)
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

describe('findHardwareHolder', () => {
    const device = TEST_CUSTODY.hardware.device
    const ledger = (
        id: string,
        accountIndex: number,
        deviceId = device.deviceId,
    ) =>
        buildTestAccount(
            { kind: 'hardware', device: { ...device, deviceId }, accountIndex },
            { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
            { id },
        )

    test('finds the hardware account at the device position', () => {
        const accounts = [
            testAccount('watch'),
            ledger('index-0', 0),
            ledger('index-1', 1),
            ledger('other-device', 1, 'device-2'),
        ]

        expect(
            findHardwareHolder(accounts, { ...device, accountIndex: 1 })?.id,
        ).toBe('index-1')
    })

    test('finds no holder at a USB position, whose id names a model', () => {
        const usb = { ...device, transportType: 'usb' as const }
        const accounts = [
            buildTestAccount(
                { kind: 'hardware', device: usb, accountIndex: 0 },
                { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
                { id: 'usb' },
            ),
        ]

        expect(
            findHardwareHolder(accounts, { ...usb, accountIndex: 0 }),
        ).toBeUndefined()
    })

    test('ignores another manufacturer at the same id and index', () => {
        expect(
            findHardwareHolder([ledger('ledger', 0)], {
                manufacturer: 'other' as 'ledger',
                deviceId: device.deviceId,
                accountIndex: 0,
                transportType: 'ble',
            }),
        ).toBeUndefined()
    })

    test('finds nothing without a hardware account', () => {
        expect(
            findHardwareHolder([testAccount('local'), testAccount('watch')], {
                ...device,
                accountIndex: 0,
            }),
        ).toBeUndefined()
    })
})

describe('hardwareJoinCandidates', () => {
    const ALGORAND = 'algorand' as ChainId
    const device = TEST_CUSTODY.hardware.device
    const position = { ...device, accountIndex: 0 }
    const ledger = (id: string, chains: WalletAccount['chains']) =>
        buildTestAccount(
            { kind: 'hardware', device, accountIndex: 0 },
            chains,
            {
                id,
            },
        )

    test("lists the position's accounts holding none of the chains", () => {
        const accounts = [
            ledger('algorand-only', {
                [ALGORAND]: { address: ALGORAND_ADDRESS },
            }),
            ledger('ethereum-only', {
                [ETHEREUM]: { address: EVM_KEY_ADDRESS },
            }),
            buildTestAccount(
                { kind: 'hardware', device, accountIndex: 1 },
                { [ALGORAND]: { address: ALGORAND_ADDRESS } },
                { id: 'index-1' },
            ),
            testAccount('watch'),
        ]

        expect(
            hardwareJoinCandidates(accounts, position, [ETHEREUM]).map(
                ({ id }) => id,
            ),
        ).toEqual(['algorand-only'])
    })

    test('excludes an account holding any of the chains', () => {
        const both = ledger('both', {
            [ALGORAND]: { address: ALGORAND_ADDRESS },
            [ETHEREUM]: { address: EVM_KEY_ADDRESS },
        })

        expect(
            hardwareJoinCandidates([both], position, [ALGORAND, ETHEREUM]),
        ).toEqual([])
    })
})

describe('eligibleChains', () => {
    const ALGORAND = 'algorand' as ChainId
    const ALL = [ALGORAND, ...EVM_CHAINS]

    beforeEach(() => {
        ledgerApps.clear()
        registerChainFamilies()
    })

    test('an HD account reaches every chain a seed can mint on', () => {
        const hd = buildTestAccount(TEST_CUSTODY.hd, {
            [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
        })

        expect(eligibleChains(hd)).toEqual(ALL)
    })

    test('a standalone key reaches every chain of its family that imports its scheme, and no other family', () => {
        const key = buildTestAccount(TEST_CUSTODY.local, {
            [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
        })

        expect(eligibleChains(key)).toEqual(EVM_CHAINS)
    })

    test('an Algorand-only key type reaches Algorand alone', () => {
        const algo25 = buildTestAccount(TEST_CUSTODY.local, {
            [ALGORAND]: { address: ALGORAND_ADDRESS, keyPairId: 'k' },
        })
        const quantum = buildTestAccount(TEST_CUSTODY.explicit, {
            [ALGORAND]: { address: ALGORAND_ADDRESS, keyPairId: 'q' },
        })

        expect(eligibleChains(algo25)).toEqual([ALGORAND])
        expect(eligibleChains(quantum)).toEqual([ALGORAND])
    })

    test('a watched 0x address reaches every EVM chain and never Algorand', () => {
        const watched = buildTestAccount(TEST_CUSTODY.watch, {
            [BASE]: { address: EVM_KEY_ADDRESS },
        })

        expect(eligibleChains(watched)).toEqual(EVM_CHAINS)
    })

    test('a watched Algorand address reaches Algorand alone', () => {
        const watched = buildTestAccount(TEST_CUSTODY.watch, {
            [ALGORAND]: { address: ALGORAND_ADDRESS },
        })

        expect(eligibleChains(watched)).toEqual([ALGORAND])
    })

    test('a hardware account reaches the chains with a device app', () => {
        ledgerApps.add(ETHEREUM).add(POLYGON)
        const ledger = buildTestAccount(TEST_CUSTODY.hardware, {
            [ALGORAND]: { address: ALGORAND_ADDRESS },
        })

        expect(eligibleChains(ledger)).toEqual([ALGORAND, ETHEREUM, POLYGON])
    })

    test('a multisig account stays on its own chain', () => {
        const multisig = buildTestAccount(TEST_CUSTODY.multisig, {
            [ALGORAND]: { address: ALGORAND_ADDRESS },
        })

        expect(eligibleChains(multisig)).toEqual([ALGORAND])
    })

    test('leaves out an entry on a chain this build does not register', () => {
        registerChainFamilies([ALGORAND, ETHEREUM])
        const key = buildTestAccount(TEST_CUSTODY.local, {
            [POLYGON]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
            [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
        })

        expect(eligibleChains(key)).toEqual([ETHEREUM])
    })
})

describe('eligibleChainsInFamily', () => {
    beforeEach(() => {
        registerChainFamilies()
    })

    test('keeps the eligible chains in the families the account is on', () => {
        const hd = buildTestAccount(TEST_CUSTODY.hd, {
            [ETHEREUM]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
        })

        expect(eligibleChainsInFamily(hd)).toEqual(EVM_CHAINS)
    })

    test('offers an Algorand-only HD account nothing new', () => {
        const hd = buildTestAccount(TEST_CUSTODY.hd, {
            ['algorand' as ChainId]: {
                address: ALGORAND_ADDRESS,
                keyPairId: 'k',
            },
        })

        expect(eligibleChainsInFamily(hd)).toEqual(['algorand'])
    })
})

describe('hdDiscoveryChains', () => {
    const ALGORAND = 'algorand' as ChainId
    const capabilitiesOn = Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, true]),
    ) as ChainCapabilities

    test('lists every registered chain a seed mints on, in registry order', () => {
        registerChainFamilies()

        expect(hdDiscoveryChains()).toEqual([ALGORAND, ...EVM_CHAINS])
    })

    test('leaves out a switched-off chain', () => {
        registerChainFamilies([ALGORAND, ETHEREUM, BASE])
        getProvider().chains.setCapabilityOverrides(() => ({
            chainEnabled: { [BASE]: false },
        }))

        expect(hdDiscoveryChains()).toEqual([ALGORAND, ETHEREUM])
    })

    test('leaves out a chain with no accounts adapter', () => {
        registerChainFamilies([ALGORAND])
        getProvider().chains.register(
            {
                id: POLYGON,
                family: 'evm',
                signing: {
                    schemes: ['secp256k1'],
                    derivationPaths: { secp256k1: () => "m/44'/60'/0'/0/0" },
                },
            } as unknown as ChainDescriptor,
            capabilitiesOn,
        )

        expect(hdDiscoveryChains()).toEqual([ALGORAND])
    })

    test('leaves out a chain no seed derivation path reaches', () => {
        registerChainFamilies([ALGORAND])
        getProvider().chains.register(
            {
                id: POLYGON,
                family: 'evm',
                signing: { schemes: ['secp256k1'], derivationPaths: {} },
            } as unknown as ChainDescriptor,
            capabilitiesOn,
        )
        accountsChainAdapters.register({
            chainId: POLYGON,
        } as unknown as AccountsChainAdapter)

        expect(hdDiscoveryChains()).toEqual([ALGORAND])
    })
})

describe('default chains', () => {
    const ALGORAND = 'algorand' as ChainId

    beforeEach(() => {
        registerChainFamilies()
    })

    test('an HD account defaults to every eligible chain flagged as default', () => {
        const hd = buildTestAccount(TEST_CUSTODY.hd, {
            [ALGORAND]: { address: ALGORAND_ADDRESS, keyPairId: 'k' },
        })

        expect(defaultChains(hd)).toEqual([ALGORAND, ETHEREUM])
    })

    test('a standalone key defaults to the default chains of its own family', () => {
        const key = buildTestAccount(TEST_CUSTODY.local, {
            [POLYGON]: { address: EVM_KEY_ADDRESS, keyPairId: 'k' },
        })

        expect(defaultChains(key)).toEqual([ETHEREUM])
    })

    test('defaults to Algorand alone when no other chain is registered', () => {
        registerChainFamilies([ALGORAND])
        const hd = buildTestAccount(TEST_CUSTODY.hd, {
            [ALGORAND]: { address: ALGORAND_ADDRESS, keyPairId: 'k' },
        })

        expect(defaultChains(hd)).toEqual([ALGORAND])
    })

    test('reads the flag only for registered chains', () => {
        registerChainFamilies([ALGORAND])

        expect(isEnabledByDefault(ALGORAND)).toBe(true)
        expect(isEnabledByDefault(ETHEREUM)).toBe(false)
        expect(isEnabledByDefault(BASE)).toBe(false)
    })

    test('prefers a default chain even when a non-default one comes first', () => {
        expect(preferDefaultChain([BASE, ETHEREUM, POLYGON])).toBe(ETHEREUM)
    })

    test('falls back to the first candidate when none is a default chain', () => {
        expect(preferDefaultChain([POLYGON, BASE])).toBe(POLYGON)
    })

    test('prefers nothing from no candidates', () => {
        expect(preferDefaultChain([])).toBeUndefined()
    })
})
