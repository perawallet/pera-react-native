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
import type { MultisigParameters } from '@perawallet/wallet-core-multisig'
import {
    standaloneAccount,
    hardwareAccount,
    hdAccount,
    multisigAccount,
    quantumAccount,
    watchAccount,
    type AlgorandAccountOptions,
} from '../../__tests__/algorandAccounts'
import { algorandAccountsAdapter } from '../adapter'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    algorandCapabilityDefaults,
    algorandCapabilityRestrictions,
} from '../../capability-defaults'
import { algorandDescriptor } from '../../descriptor'
import { algorandAuthority, AlgorandAuthorityTargetKinds } from '../authority'
import { seedAuthority } from './seedAuthority'

const mainnet = scopeForLegacyNetwork('mainnet')
const testnet = scopeForLegacyNetwork('testnet')

beforeAll(() => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
})

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
    registerAlgorandChain(true)
})

type Options = AlgorandAccountOptions & { address?: string }

// The chain reads its own `quantumAccounts` capability.
const registerAlgorandChain = (quantumAccounts: boolean) => {
    const { chains } = getProvider()
    chains.reset()
    chains.register(
        algorandDescriptor,
        { ...algorandCapabilityDefaults, quantumAccounts },
        algorandCapabilityRestrictions,
    )
}

const algo25 = ({ address = 'A', ...options }: Options = {}) =>
    standaloneAccount(address, { id: 'a', keyPairId: 'kp', ...options })
const hd = ({ address = 'H', ...options }: Options = {}) =>
    hdAccount(address, { id: 'h', keyPairId: 'kp-hd', ...options })
const ledger = ({ address = 'L', ...options }: Options = {}) =>
    hardwareAccount(address, { id: 'l', ...options })
const watch = ({ address = 'W', ...options }: Options = {}) =>
    watchAccount(address, { id: 'w', ...options })
const multisig = ({
    address = 'M',
    parameters = { threshold: 2, addresses: ['P1', 'P2', 'P3'], version: 1 },
    ...options
}: Options & { parameters?: MultisigParameters } = {}) =>
    multisigAccount(address, parameters, { id: 'm', ...options })
const quantum = ({ address = 'F', ...options }: Options = {}) =>
    quantumAccount(address, { id: 'f', keyPairId: 'kp-quantum', ...options })

const source = (address: string) => algo25({ id: `src-${address}`, address })

const isEligibleRekeyTarget = (
    target: WalletAccount,
    from: WalletAccount,
    scope = mainnet,
) =>
    algorandAuthority.isEligibleTarget(
        AlgorandAuthorityTargetKinds.standard,
        target,
        from,
        [],
        scope,
    )
const isEligibleQuantumRekeyTarget = (
    target: WalletAccount,
    from: WalletAccount,
    isQuantumTargetEnabled: boolean,
) => {
    registerAlgorandChain(isQuantumTargetEnabled)
    return algorandAuthority.isEligibleTarget(
        AlgorandAuthorityTargetKinds.quantum,
        target,
        from,
        [],
        mainnet,
    )
}
const isEligibleLedgerRekeyTarget = (
    target: WalletAccount,
    from: WalletAccount,
) =>
    algorandAuthority.isEligibleTarget(
        AlgorandAuthorityTargetKinds.hardware,
        target,
        from,
        [],
        mainnet,
    )
const isEligibleSharedRekeyTarget = (
    target: WalletAccount,
    from: WalletAccount,
    accounts: WalletAccount[],
) =>
    algorandAuthority.isEligibleTarget(
        AlgorandAuthorityTargetKinds.shared,
        target,
        from,
        accounts,
        mainnet,
    )
const getAccountsRekeyedTo = algorandAuthority.accountsDelegatedTo
const canSignProgram = (account: WalletAccount, scope = mainnet) =>
    algorandAuthority.canSignProgram(account, scope)

describe('algorandAuthority.targetKinds', () => {
    test('files each rekey target kind under the flow that offers it', () => {
        expect(algorandAuthority.targetKinds).toEqual([
            { id: 'standard', category: 'standard' },
            { id: 'quantum', category: 'postQuantum' },
            { id: 'hardware', category: 'hardware' },
            { id: 'shared', category: 'shared' },
        ])
    })

    test('treats an unknown kind as ineligible', () => {
        expect(
            algorandAuthority.isEligibleTarget(
                'unknown',
                algo25(),
                source('SRC'),
                [],
                mainnet,
            ),
        ).toBe(false)
    })

    test('treats quantum targets as disabled while the chain is not registered', () => {
        getProvider().chains.reset()

        expect(
            algorandAuthority.isEligibleTarget(
                AlgorandAuthorityTargetKinds.quantum,
                quantum(),
                source('SRC'),
                [],
                mainnet,
            ),
        ).toBe(false)
    })
})

describe('algorandAuthority.isAuthorityDowngrade', () => {
    test('a quantum source to an Ed25519 target is a downgrade', () => {
        const from = quantum()
        const to = algo25()

        expect(
            algorandAuthority.isAuthorityDowngrade(
                from,
                to,
                [from, to],
                mainnet,
            ),
        ).toBe(true)
    })

    test('reads the effective authority one rekey hop away', () => {
        const from = algo25()
        const auth = quantum()
        const to = hd()
        seedAuthority('A', 'F')
        const accounts = [from, auth, to]

        expect(
            algorandAuthority.isAuthorityDowngrade(from, to, accounts, mainnet),
        ).toBe(true)
        expect(
            algorandAuthority.isAuthorityDowngrade(to, from, accounts, mainnet),
        ).toBe(false)
    })
})

describe('algorandAuthority.isDelegated', () => {
    const baseAccount = hd({ address: 'ADDR1' })

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
        expect(
            canSignProgram(ledger({ address: 'HW', keyPairId: 'pk1' })),
        ).toBe(false)
        expect(
            canSignProgram(multisig({ address: 'M', keyPairId: 'pk1' })),
        ).toBe(false)
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
    const src = source('SRC')

    test('rejects target equal to source', () => {
        expect(
            isEligibleRekeyTarget(algo25({ address: 'A' }), source('A')),
        ).toBe(false)
    })

    test("rejects target equal to source's current auth", () => {
        seedAuthority('SRC', 'B')
        expect(
            isEligibleRekeyTarget(algo25({ address: 'B' }), source('SRC')),
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
        const noKey = algo25({ address: 'A', keyPairId: null })
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
            isEligibleRekeyTarget(algo25({ address: 'A' }), source('SRC')),
        ).toBe(true)
    })
})

describe('services/accounts/utils - isEligibleQuantumRekeyTarget', () => {
    const src = source('SRC')

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
                source('F'),
                true,
            ),
        ).toBe(false)
    })

    test("rejects target equal to source's current auth", () => {
        seedAuthority('SRC', 'F')
        expect(
            isEligibleQuantumRekeyTarget(
                quantum({ address: 'F' }),
                source('SRC'),
                true,
            ),
        ).toBe(false)
    })

    test('rejects target without signing keys', () => {
        const noKey = quantum({ address: 'F', keyPairId: null })
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
                source('SRC'),
                true,
            ),
        ).toBe(true)
    })
})

describe('services/accounts/utils - isEligibleLedgerRekeyTarget', () => {
    const src = source('SRC')

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
            isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), source('L')),
        ).toBe(false)
        seedAuthority('L', 'X')
        expect(isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), src)).toBe(
            false,
        )
    })

    test("rejects target equal to source's current auth", () => {
        seedAuthority('SRC', 'L')
        expect(
            isEligibleLedgerRekeyTarget(
                ledger({ address: 'L' }),
                source('SRC'),
            ),
        ).toBe(false)
    })

    test('accepts a clean hardware target', () => {
        expect(isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), src)).toBe(
            true,
        )
    })
})

describe('services/accounts/utils - isEligibleSharedRekeyTarget', () => {
    const src = source('SRC')

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
            parameters: {
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
            parameters: {
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
            parameters: {
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
            parameters: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [algo25({ id: 'p1', address: 'P1' })]
        seedAuthority('SRC', 'M')
        expect(isEligibleSharedRekeyTarget(ms, source('SRC'), all)).toBe(false)
    })

    test('rejects multisig already rekeyed away', () => {
        const ms = multisig({
            address: 'M',
            parameters: {
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
