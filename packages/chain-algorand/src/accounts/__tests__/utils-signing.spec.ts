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

import { beforeAll, beforeEach, describe, test, expect } from 'vitest'
import {
    accountsChainAdapters,
    canSignWith,
    getDelegatedAccount,
    getSignerFor,
    isAuthorityDowngrade,
    delegateTransitionFor,
    resolveAuthAccount,
    useAccountChainStateStore,
    DelegationTargetNotFoundError,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
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
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAccountsAdapter } from '../adapter'
import { algorandAddressOf } from '../vocabulary'
import { seedAuthority } from './seedAuthority'

beforeAll(() => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
})

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
})

type Options = AlgorandAccountOptions & { address?: string; authority?: string }

const withAuthority = (
    account: WalletAccount,
    authority?: string,
): WalletAccount => {
    if (authority) {
        seedAuthority(algorandAddressOf(account) as string, authority)
    }
    return account
}

const algo25 = ({ address = 'A', authority, ...options }: Options = {}) =>
    withAuthority(standaloneAccount(address, options), authority)
const hd = ({ address = 'H', authority, ...options }: Options = {}) =>
    withAuthority(hdAccount(address, options), authority)
const ledger = ({ address = 'L', authority, ...options }: Options = {}) =>
    withAuthority(hardwareAccount(address, options), authority)
const watch = ({ address = 'W', authority, ...options }: Options = {}) =>
    withAuthority(watchAccount(address, options), authority)
const multisig = ({
    address = 'M',
    parameters = { threshold: 2, addresses: ['P1', 'P2'], version: 1 },
    authority,
    ...options
}: Options & { parameters?: MultisigParameters } = {}) =>
    withAuthority(multisigAccount(address, parameters, options), authority)
const quantum = ({ address = 'F', authority, ...options }: Options = {}) =>
    withAuthority(quantumAccount(address, options), authority)

const isQuantumDowngrade = (
    source: WalletAccount,
    target: WalletAccount,
    accounts: WalletAccount[],
) => isAuthorityDowngrade(source, target, accounts, ALGORAND_CHAIN_ID)

describe('services/accounts/utils - account type checks', () => {
    const baseAccount = hd({ address: 'ADDR1' })

    test('canSignWith returns true for account with keyPairId', () => {
        expect(canSignWith(baseAccount, [], ALGORAND_CHAIN_ID)).toBe(true)
    })

    test('canSignWith returns false for account without keyPairId', () => {
        expect(
            canSignWith(
                hd({ address: 'ADDR1', keyPairId: null }),
                [],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    test('canSignWith returns true for rekeyed account when auth account has keys', () => {
        const authAccount = algo25({ address: 'AUTH_ADDR' })
        const rekeyedAccount = watch({
            address: 'REKEYED_ADDR',
            authority: 'AUTH_ADDR',
        })

        expect(
            canSignWith(rekeyedAccount, [authAccount], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    test('canSignWith returns false for rekeyed account when auth account has no keys', () => {
        const authAccount = watch({ address: 'AUTH_ADDR' })
        const rekeyedAccount = watch({
            address: 'REKEYED_ADDR',
            authority: 'AUTH_ADDR',
        })

        expect(
            canSignWith(rekeyedAccount, [authAccount], ALGORAND_CHAIN_ID),
        ).toBe(false)
    })

    test('canSignWith returns false for rekeyed account when auth account is not in list', () => {
        const rekeyedAccount = watch({
            address: 'REKEYED_ADDR',
            authority: 'AUTH_ADDR',
        })

        expect(canSignWith(rekeyedAccount, [], ALGORAND_CHAIN_ID)).toBe(false)
    })

    test('canSignWith resolves a single rekey hop only, not a chain', () => {
        const rootAccount = algo25({ address: 'ROOT_ADDR' })
        const middleAccount = watch({
            address: 'MIDDLE_ADDR',
            authority: 'ROOT_ADDR',
        })
        const leafAccount = watch({
            address: 'LEAF_ADDR',
            authority: 'MIDDLE_ADDR',
        })

        const accounts = [rootAccount, middleAccount, leafAccount]
        // LEAF -> MIDDLE -> ROOT. MIDDLE holds no key, so LEAF cannot sign —
        // the hop from MIDDLE to ROOT is not followed.
        expect(canSignWith(leafAccount, accounts, ALGORAND_CHAIN_ID)).toBe(
            false,
        )
        // MIDDLE -> ROOT, and ROOT holds a key, so MIDDLE can sign (one hop).
        expect(canSignWith(middleAccount, accounts, ALGORAND_CHAIN_ID)).toBe(
            true,
        )
    })

    test('canSignWith does not recurse on a cyclic auth chain', () => {
        const a = watch({ address: 'A', authority: 'B' })
        const b = watch({ address: 'B', authority: 'A' })

        // Single-hop: A's immediate auth B holds no key — false, no infinite
        // recursion.
        expect(canSignWith(a, [a, b], ALGORAND_CHAIN_ID)).toBe(false)
    })
})

describe('services/accounts/utils - canSignWith (hardware + multisig)', () => {
    test('returns true for a non-rekeyed hardware account (no keyPairId)', () => {
        const account = ledger({ address: 'HW' })
        expect(canSignWith(account, [account], ALGORAND_CHAIN_ID)).toBe(true)
    })

    test('returns true for rekeyed account whose auth is a hardware account', () => {
        const authAccount = ledger({ address: 'AUTH' })
        const account = watch({ address: 'ADDR', authority: 'AUTH' })
        expect(
            canSignWith(account, [account, authAccount], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    test('returns true for a multisig with a local signable participant', () => {
        const participant = algo25({ address: 'P1' })
        const account = multisig({ address: 'MS' })
        expect(
            canSignWith(account, [account, participant], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    test('returns false for a multisig with no local signable participants', () => {
        const account = multisig({ address: 'MS' })
        expect(canSignWith(account, [account], ALGORAND_CHAIN_ID)).toBe(false)
    })
})

describe('services/accounts/utils - getDelegatedAccount', () => {
    test('returns the auth account when rekeyed and target is in the wallet', () => {
        const auth = algo25({ address: 'AUTH' })
        const rekeyed = algo25({ address: 'A', authority: 'AUTH' })
        expect(
            getDelegatedAccount('A', [rekeyed, auth], ALGORAND_CHAIN_ID),
        ).toBe(auth)
    })

    test('returns null when the address is not rekeyed', () => {
        const account = algo25({ address: 'A' })
        expect(
            getDelegatedAccount('A', [account], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    test('returns null when the rekey target is not in the wallet', () => {
        const rekeyed = watch({ address: 'A', authority: 'MISSING' })
        expect(
            getDelegatedAccount('A', [rekeyed], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    test('returns null when the address is unknown', () => {
        expect(getDelegatedAccount('UNKNOWN', [], ALGORAND_CHAIN_ID)).toBeNull()
    })
})

describe('services/accounts/utils - getSignerFor', () => {
    test('returns the account itself when it holds its own key', () => {
        const account = algo25({ address: 'A' })
        expect(getSignerFor('A', [account], ALGORAND_CHAIN_ID)).toBe(account)
    })

    test('returns the immediate auth account when rekeyed and we can sign', () => {
        const auth = algo25({ address: 'AUTH' })
        const rekeyed = algo25({ address: 'A', authority: 'AUTH' })
        expect(getSignerFor('A', [rekeyed, auth], ALGORAND_CHAIN_ID)).toBe(auth)
    })

    test('returns null for an unsignable rekeyed account', () => {
        const rekeyed = watch({ address: 'A', authority: 'MISSING' })
        expect(getSignerFor('A', [rekeyed], ALGORAND_CHAIN_ID)).toBeNull()
    })

    test('returns null for a non-rekeyed watch account', () => {
        const account = watch({ address: 'A' })
        expect(getSignerFor('A', [account], ALGORAND_CHAIN_ID)).toBeNull()
    })

    test('returns the multisig itself when at least one participant is local and signable', () => {
        const participant = algo25({ address: 'P1' })
        const account = multisig({ address: 'MS' })
        expect(
            getSignerFor('MS', [account, participant], ALGORAND_CHAIN_ID),
        ).toBe(account)
    })

    test('returns null when address is not in the wallet', () => {
        expect(getSignerFor('UNKNOWN', [], ALGORAND_CHAIN_ID)).toBeNull()
    })
})

describe('services/accounts/utils - delegateTransitionFor', () => {
    test('returns null for a non-rekeyed account', () => {
        const account = algo25({ address: 'A' })
        expect(
            delegateTransitionFor(account, [account], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    test('returns null for a rekeyed account whose auth is not in the wallet', () => {
        const rekeyed = algo25({ address: 'A', authority: 'MISSING' })
        expect(
            delegateTransitionFor(rekeyed, [rekeyed], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    test('returns the rekeyed account and its signer for a signable rekey', () => {
        const auth = ledger({ address: 'AUTH' })
        const rekeyed = algo25({ address: 'A', authority: 'AUTH' })
        expect(
            delegateTransitionFor(rekeyed, [rekeyed, auth], ALGORAND_CHAIN_ID),
        ).toEqual({ from: rekeyed, to: auth })
    })
})

describe('services/accounts/utils - quantum accounts', () => {
    test('canSignWith resolves a quantum account as its own signer', () => {
        const account = quantum()
        expect(canSignWith(account, [account], ALGORAND_CHAIN_ID)).toBe(true)
    })

    test('canSignWith resolves a quantum auth account for a rekeyed account', () => {
        const auth = quantum({ address: 'FAUTH' })
        const rekeyed = watch({ address: 'A', authority: 'FAUTH' })
        expect(canSignWith(rekeyed, [rekeyed, auth], ALGORAND_CHAIN_ID)).toBe(
            true,
        )
    })
})

describe('services/accounts/utils - isAuthorityDowngrade', () => {
    test('quantum source to a plain Ed25519 target is a downgrade', () => {
        const source = quantum({ address: 'F' })
        const target = algo25({ address: 'A' })
        const hdTarget = hd({ address: 'H' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(true)
        expect(isQuantumDowngrade(source, hdTarget, [source, hdTarget])).toBe(
            true,
        )
    })

    test('quantum source to a quantum target is not a downgrade', () => {
        const source = quantum({ address: 'F1' })
        const target = quantum({ address: 'F2' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(false)
    })

    test('Ed25519 source to a quantum target is not a downgrade', () => {
        const source = algo25({ address: 'A' })
        const target = quantum({ address: 'F' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(false)
    })

    test('Ed25519 source to an Ed25519 target is not a downgrade', () => {
        const source = algo25({ address: 'A' })
        const target = hd({ address: 'H' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(false)
    })

    test('quantum source to a target whose effective auth is quantum is not a downgrade', () => {
        // Target is itself rekeyed to a quantum account, so its effective
        // signing authority resolves to quantum via resolveAuthAccount.
        const source = quantum({ address: 'F1' })
        const quantumAuth = quantum({ address: 'FAUTH' })
        const target = watch({ address: 'T', authority: 'FAUTH' })
        expect(
            isQuantumDowngrade(source, target, [source, target, quantumAuth]),
        ).toBe(false)
    })

    test('quantum source to a hardware/ledger target is a downgrade', () => {
        const source = quantum({ address: 'F' })
        const target = ledger({ address: 'L' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(true)
    })

    test('Ed25519 source rekeyed to a quantum auth (rekey-in), rekeying to an Ed25519 target, is a downgrade', () => {
        // The flagship migration path: the account's own type stays algo25,
        // but its effective signer is quantum — rekeying to Ed25519 strips it.
        const quantumAuth = quantum({ address: 'FAUTH' })
        const source = algo25({ address: 'A', authority: 'FAUTH' })
        const target = algo25({ address: 'B' })
        expect(
            isQuantumDowngrade(source, target, [source, target, quantumAuth]),
        ).toBe(true)
    })

    test('quantum-typed source already rekeyed to an Ed25519 auth is not a downgrade', () => {
        // Its effective signer is already Ed25519 — there is no quantum
        // protection left to remove, so the warning would be untrue.
        const ed25519Auth = algo25({ address: 'EAUTH' })
        const source = quantum({ address: 'F', authority: 'EAUTH' })
        const target = algo25({ address: 'B' })
        expect(
            isQuantumDowngrade(source, target, [source, target, ed25519Auth]),
        ).toBe(false)
    })

    test('source whose auth is not held locally (broken chain) is not a downgrade', () => {
        // resolveAuthAccount throws when the auth is unheld; we cannot assert
        // quantum protection we cannot resolve.
        const source = quantum({ address: 'F', authority: 'MISSING' })
        const target = algo25({ address: 'B' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(false)
    })
})

describe('services/accounts/utils - resolveAuthAccount', () => {
    test('returns the account itself when not rekeyed', () => {
        const a = algo25({ address: 'A' })
        expect(resolveAuthAccount(a, [a], ALGORAND_CHAIN_ID)).toBe(a)
    })

    test('walks a single rekey hop', () => {
        const a = algo25({ address: 'A', authority: 'B' })
        const b = algo25({ address: 'B' })
        expect(resolveAuthAccount(a, [a, b], ALGORAND_CHAIN_ID)).toBe(b)
    })

    test('resolves a single hop only — not the terminal of the chain', () => {
        // A -> B -> C. B signs for A; rekey indirection is not transitive.
        const a = ledger({ address: 'A', authority: 'B' })
        const b = ledger({ address: 'B', authority: 'C' })
        const c = ledger({ address: 'C' })
        expect(resolveAuthAccount(a, [a, b, c], ALGORAND_CHAIN_ID)).toBe(b)
    })

    test('throws DelegationTargetNotFoundError when the auth account is not held', () => {
        const a = algo25({ address: 'A', authority: 'MISSING' })
        expect(() => resolveAuthAccount(a, [a], ALGORAND_CHAIN_ID)).toThrow(
            DelegationTargetNotFoundError,
        )
    })
})
