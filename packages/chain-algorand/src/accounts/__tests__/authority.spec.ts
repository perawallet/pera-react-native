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

import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import {
    accountsChainAdapters,
    useAccountChainStateStore,
    canSignArbitraryData,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAccountsAdapter } from '../adapter'
import { algorandAuthority } from '../authority'
import { seedAuthority } from './seedAuthority'

const mainnet = scopeForLegacyNetwork('mainnet')
const testnet = scopeForLegacyNetwork('testnet')

beforeAll(() => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
})

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
})

const asAccount = (partial: object) => partial as WalletAccount
const noQuantum = { isQuantumTargetEnabled: false }

const isEligibleRekeyTarget = (
    target: WalletAccount,
    source: object,
    scope = mainnet,
) =>
    algorandAuthority.isEligibleTarget(
        'standard',
        target,
        asAccount(source),
        [],
        scope,
        noQuantum,
    )
const isEligibleQuantumRekeyTarget = (
    target: WalletAccount,
    source: object,
    isQuantumTargetEnabled: boolean,
) =>
    algorandAuthority.isEligibleTarget(
        'quantum',
        target,
        asAccount(source),
        [],
        mainnet,
        { isQuantumTargetEnabled },
    )
const isEligibleLedgerRekeyTarget = (target: WalletAccount, source: object) =>
    algorandAuthority.isEligibleTarget(
        'hardware',
        target,
        asAccount(source),
        [],
        mainnet,
        noQuantum,
    )
const isEligibleSharedRekeyTarget = (
    target: WalletAccount,
    source: object,
    accounts: WalletAccount[],
) =>
    algorandAuthority.isEligibleTarget(
        'shared',
        target,
        asAccount(source),
        accounts,
        mainnet,
        noQuantum,
    )
const getAccountsRekeyedTo = algorandAuthority.accountsDelegatedTo
const canSignProgram = (account: WalletAccount, scope = mainnet) =>
    algorandAuthority.canSignProgram(account, scope)

const algo25 = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'a',
        address: overrides.address ?? 'A',
        custody: { kind: 'local', seed: null },
        keyPairId: 'kp',
        ...overrides,
    }) as WalletAccount

const hd = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'h',
        address: overrides.address ?? 'H',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        keyPairId: 'kp-hd',
        hdWalletDetails: {
            account: 0,
            change: 0,
            keyIndex: 0,
            derivationType: 9,
        },
        ...overrides,
    }) as WalletAccount

const ledger = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'l',
        address: overrides.address ?? 'L',
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'dev',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
        hardwareDetails: { deviceId: 'dev', addressIndex: 0 },
        ...overrides,
    }) as WalletAccount

const watch = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'w',
        address: overrides.address ?? 'W',
        custody: { kind: 'watch' },
        ...overrides,
    }) as WalletAccount

const multisig = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'm',
        address: overrides.address ?? 'M',
        custody: { kind: 'multisig' },
        multisigDetails: {
            threshold: 2,
            addresses: ['P1', 'P2', 'P3'],
            version: 1,
        },
        ...overrides,
    }) as WalletAccount

const quantum = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'f',
        address: overrides.address ?? 'F',
        custody: { kind: 'local', seed: 'quantum' },
        keyPairId: 'kp-quantum',
        ...overrides,
    }) as WalletAccount

describe('algorandAuthority.isDelegated', () => {
    const baseAccount = {
        id: '1',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        address: 'ADDR1',
        keyPairId: 'pk1',
    } as any

    test('is true once the scope has an authority', () => {
        expect(algorandAuthority.isDelegated(baseAccount, mainnet)).toBe(false)

        seedAuthority('ADDR1', 'ADDR2')

        expect(algorandAuthority.isDelegated(baseAccount, mainnet)).toBe(true)
    })

    test('answers per scope', () => {
        seedAuthority('ADDR1', 'ADDR2', testnet)

        expect(algorandAuthority.isDelegated(baseAccount, testnet)).toBe(true)
        expect(algorandAuthority.isDelegated(baseAccount, mainnet)).toBe(false)
    })
})

describe('algorandAuthority.canSignProgram', () => {
    const localKey = algo25({ address: 'HD' })
    const hardware = ledger({ address: 'HW' })
    const watchAccount = watch({ address: 'W' })
    const multisigAccount = multisig({ address: 'M' })

    test('canSignProgram excludes hardware, which has no program-signing path', () => {
        expect(canSignProgram(localKey)).toBe(true)
        expect(canSignProgram(hardware)).toBe(false)
        expect(canSignProgram(watchAccount)).toBe(false)
        expect(canSignProgram(multisigAccount)).toBe(false)
    })

    // Guards the reason canSignProgram checks the account type rather than
    // relying on hardware and multisig accounts happening to carry no
    // keyPairId: the field is optional on the base type, so nothing stops one
    // appearing. A delegated LSig carries a single sigkey, so multisig can
    // never be represented regardless of what keys it holds.
    test('canSignProgram stays false for hardware and multisig even with a keyPairId', () => {
        expect(canSignProgram({ ...hardware, keyPairId: 'pk1' })).toBe(false)
        expect(canSignProgram({ ...multisigAccount, keyPairId: 'pk1' })).toBe(
            false,
        )
    })

    // A delegated LSig is checked against the sender's auth-addr, so only the
    // auth account could usefully sign it. Refused until the signer resolves
    // that; canSignArbitraryData ignores rekeys (no auth-addr off-chain).
    test('canSignProgram excludes rekeyed accounts, unlike canSignArbitraryData', () => {
        seedAuthority('HD', 'AUTH')
        expect(canSignProgram(localKey)).toBe(false)
        expect(canSignArbitraryData(localKey)).toBe(true)
    })
})

describe('services/accounts/utils - isEligibleRekeyTarget', () => {
    const src = { address: 'SRC' }

    test('rejects target equal to source', () => {
        expect(
            isEligibleRekeyTarget(algo25({ address: 'A' }), { address: 'A' }),
        ).toBe(false)
    })

    test("rejects target equal to source's current auth", () => {
        seedAuthority('SRC', 'B')
        expect(
            isEligibleRekeyTarget(algo25({ address: 'B' }), { address: 'SRC' }),
        ).toBe(false)
    })

    test("excludes the source's authority only on the scope it was given", () => {
        seedAuthority('SRC', 'B', testnet)
        const target = algo25({ address: 'B' })

        expect(isEligibleRekeyTarget(target, src, testnet)).toBe(false)
        expect(isEligibleRekeyTarget(target, src, mainnet)).toBe(true)
    })

    test('rejects multisig / hardware / watch targets', () => {
        expect(isEligibleRekeyTarget(multisig({ address: 'M' }), src)).toBe(
            false,
        )
        expect(isEligibleRekeyTarget(ledger({ address: 'L' }), src)).toBe(false)
        expect(isEligibleRekeyTarget(watch({ address: 'W' }), src)).toBe(false)
    })

    test('rejects quantum targets (the dedicated rekey-to-quantum flow lists them)', () => {
        expect(isEligibleRekeyTarget(quantum({ address: 'F' }), src)).toBe(
            false,
        )
    })

    test('rejects target without signing keys', () => {
        const noKey = algo25({ address: 'A' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(noKey as any).keyPairId = undefined
        expect(isEligibleRekeyTarget(noKey, src)).toBe(false)
    })

    test('rejects target already rekeyed away', () => {
        seedAuthority('A', 'B')
        expect(isEligibleRekeyTarget(algo25({ address: 'A' }), src)).toBe(false)
    })

    test('accepts valid algo25 / hdWallet target', () => {
        expect(isEligibleRekeyTarget(algo25({ address: 'A' }), src)).toBe(true)
        expect(isEligibleRekeyTarget(hd({ address: 'H' }), src)).toBe(true)
    })

    test('accepts a rekeyed source rekeying to a different fresh target', () => {
        seedAuthority('SRC', 'B')
        expect(
            isEligibleRekeyTarget(algo25({ address: 'A' }), { address: 'SRC' }),
        ).toBe(true)
    })
})

describe('services/accounts/utils - isEligibleQuantumRekeyTarget', () => {
    const src = { address: 'SRC' }

    test('accepts a quantum target when quantum targets are enabled (rekey-in migration path)', () => {
        expect(
            isEligibleQuantumRekeyTarget(quantum({ address: 'F' }), src, true),
        ).toBe(true)
    })

    test('rejects a quantum target when quantum targets are disabled', () => {
        expect(
            isEligibleQuantumRekeyTarget(quantum({ address: 'F' }), src, false),
        ).toBe(false)
    })

    test('rejects every non-quantum account type', () => {
        for (const target of [
            algo25({ address: 'A' }),
            hd({ address: 'H' }),
            ledger({ address: 'L' }),
            multisig({ address: 'M' }),
            watch({ address: 'W' }),
        ]) {
            expect(isEligibleQuantumRekeyTarget(target, src, true)).toBe(false)
        }
    })

    test('rejects target equal to source', () => {
        expect(
            isEligibleQuantumRekeyTarget(
                quantum({ address: 'F' }),
                { address: 'F' },
                true,
            ),
        ).toBe(false)
    })

    test("rejects target equal to source's current auth", () => {
        seedAuthority('SRC', 'F')
        expect(
            isEligibleQuantumRekeyTarget(
                quantum({ address: 'F' }),
                { address: 'SRC' },
                true,
            ),
        ).toBe(false)
    })

    test('rejects target without signing keys', () => {
        const noKey = quantum({ address: 'F' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(noKey as any).keyPairId = undefined
        expect(isEligibleQuantumRekeyTarget(noKey, src, true)).toBe(false)
    })

    test('rejects a quantum target already rekeyed away', () => {
        seedAuthority('F', 'X')
        expect(
            isEligibleQuantumRekeyTarget(quantum({ address: 'F' }), src, true),
        ).toBe(false)
    })

    test('accepts a rekeyed source rekeying to a different fresh quantum target', () => {
        seedAuthority('SRC', 'B')
        expect(
            isEligibleQuantumRekeyTarget(
                quantum({ address: 'F' }),
                { address: 'SRC' },
                true,
            ),
        ).toBe(true)
    })
})

describe('services/accounts/utils - isEligibleLedgerRekeyTarget', () => {
    const src = { address: 'SRC' }

    test('rejects non-hardware targets', () => {
        expect(isEligibleLedgerRekeyTarget(algo25({ address: 'A' }), src)).toBe(
            false,
        )
        expect(isEligibleLedgerRekeyTarget(hd({ address: 'H' }), src)).toBe(
            false,
        )
    })

    test('rejects target equal to source / already rekeyed', () => {
        expect(
            isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), {
                address: 'L',
            }),
        ).toBe(false)
        seedAuthority('L', 'X')
        expect(isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), src)).toBe(
            false,
        )
    })

    test("rejects target equal to source's current auth", () => {
        seedAuthority('SRC', 'L')
        expect(
            isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), {
                address: 'SRC',
            }),
        ).toBe(false)
    })

    test('accepts a clean hardware target', () => {
        expect(isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), src)).toBe(
            true,
        )
    })
})

describe('services/accounts/utils - isEligibleSharedRekeyTarget', () => {
    const src = { address: 'SRC' }

    test('rejects non-multisig targets', () => {
        const all: WalletAccount[] = []
        expect(
            isEligibleSharedRekeyTarget(algo25({ address: 'A' }), src, all),
        ).toBe(false)
        expect(
            isEligibleSharedRekeyTarget(ledger({ address: 'L' }), src, all),
        ).toBe(false)
    })

    test('rejects multisig when the wallet holds none of its participants', () => {
        const ms = multisig({
            address: 'M',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [algo25({ id: 'x', address: 'OTHER' })]
        expect(isEligibleSharedRekeyTarget(ms, src, all)).toBe(false)
    })

    test('rejects multisig when the only held participant cannot sign', () => {
        // A watch-only participant has no key of its own — it can't propose.
        const ms = multisig({
            address: 'M',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [watch({ id: 'p1', address: 'P1' })]
        expect(isEligibleSharedRekeyTarget(ms, src, all)).toBe(false)
    })

    test('accepts multisig when the wallet holds one signable participant, even below threshold', () => {
        // Propose-based signing: one local participant can propose; the
        // remaining signatures are collected from co-signers.
        const ms = multisig({
            address: 'M',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [algo25({ id: 'p1', address: 'P1' })]
        expect(isEligibleSharedRekeyTarget(ms, src, all)).toBe(true)
    })

    test("rejects multisig equal to source's current auth", () => {
        const ms = multisig({
            address: 'M',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [algo25({ id: 'p1', address: 'P1' })]
        seedAuthority('SRC', 'M')
        expect(isEligibleSharedRekeyTarget(ms, { address: 'SRC' }, all)).toBe(
            false,
        )
    })

    test('rejects multisig already rekeyed away', () => {
        const ms = multisig({
            address: 'M',
            multisigDetails: {
                threshold: 1,
                addresses: ['P1'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [algo25({ id: 'p1', address: 'P1' })]
        seedAuthority('M', 'X')
        expect(isEligibleSharedRekeyTarget(ms, src, all)).toBe(false)
    })
})

describe('services/accounts/utils - getAccountsRekeyedTo', () => {
    test('returns the accounts whose active-network auth-addr is the address', () => {
        const target = quantum({ address: 'PQ' })
        const rekeyed = algo25({ address: 'A' })
        seedAuthority('A', 'PQ')
        const unrelated = algo25({ address: 'B' })

        expect(
            getAccountsRekeyedTo('PQ', [target, rekeyed, unrelated]),
        ).toEqual([rekeyed])
    })

    test('excludes the address itself', () => {
        const selfRekeyed = algo25({ address: 'A' })
        seedAuthority('A', 'A')
        expect(getAccountsRekeyedTo('A', [selfRekeyed])).toEqual([])
    })

    test('matches a rekey recorded on a non-active network', () => {
        const rekeyed = algo25({ address: 'A' })
        seedAuthority('A', 'PQ', mainnet)
        seedAuthority('A', null, testnet)
        expect(getAccountsRekeyedTo('PQ', [rekeyed])).toEqual([rekeyed])
    })

    test('returns an empty list when nothing points at the address', () => {
        seedAuthority('A', 'OTHER')
        expect(getAccountsRekeyedTo('PQ', [algo25({ address: 'A' })])).toEqual(
            [],
        )
    })
})
