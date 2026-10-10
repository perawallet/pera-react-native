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

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
    accountsChainAdapters,
    canSignWith,
    getDelegatedAccount,
    getSignerFor,
    isMultisigUnsignable,
    delegateTransitionFor,
    resolveSignerFor,
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    standaloneAccount,
    hardwareAccount,
    hdAccount,
    multisigAccount,
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

const rekeyedTo = <T extends WalletAccount>(
    account: T,
    authority: string,
): T => {
    seedAuthority(algorandAddressOf(account) as string, authority)
    return account
}

const algo25 = (address: string, options: AlgorandAccountOptions = {}) =>
    standaloneAccount(address, { keyPairId: 'kp', ...options })

const hdWallet = (address: string) => hdAccount(address, { keyPairId: 'kp' })

const hardware = (address: string) => hardwareAccount(address)

const multisig = (address: string, participants: string[]) =>
    multisigAccount(address, {
        threshold: 2,
        addresses: participants,
        version: 1,
    })

const watch = (address: string, authority?: string) =>
    authority
        ? rekeyedTo(watchAccount(address), authority)
        : watchAccount(address)

describe('getDelegatedAccount', () => {
    it('returns null when the address is not in the wallet', () => {
        expect(
            getDelegatedAccount('Z', [algo25('A')], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    it('returns null when the account has no rekey', () => {
        const a = algo25('A')
        expect(getDelegatedAccount('A', [a], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns the auth account when the target is held', () => {
        const auth = algo25('AUTH')
        const a = rekeyedTo(algo25('A'), 'AUTH')
        expect(getDelegatedAccount('A', [a, auth], ALGORAND_CHAIN_ID)).toBe(
            auth,
        )
    })

    it('returns null when the auth target is unknown locally', () => {
        const a = rekeyedTo(algo25('A'), 'MISSING')
        expect(getDelegatedAccount('A', [a], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('reports the immediate auth — does not follow chains', () => {
        const mid = rekeyedTo(algo25('B'), 'C')
        const a = rekeyedTo(algo25('A'), 'B')
        const c = algo25('C')
        expect(getDelegatedAccount('A', [a, mid, c], ALGORAND_CHAIN_ID)).toBe(
            mid,
        )
    })
})

describe('getSignerFor', () => {
    it('returns null for an unknown address', () => {
        expect(getSignerFor('UNKNOWN', [], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns the account itself for a standard signing account', () => {
        const a = algo25('A')
        expect(getSignerFor('A', [a], ALGORAND_CHAIN_ID)).toBe(a)
    })

    it('returns the account itself for an HD wallet account', () => {
        const a = hdWallet('A')
        expect(getSignerFor('A', [a], ALGORAND_CHAIN_ID)).toBe(a)
    })

    it('returns the account itself for a hardware account (no keyPairId)', () => {
        const a = hardware('A')
        expect(getSignerFor('A', [a], ALGORAND_CHAIN_ID)).toBe(a)
    })

    it('returns null for a non-rekeyed watch account', () => {
        const a = watch('A')
        expect(getSignerFor('A', [a], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns the auth account when rekeyed to a signable algo25', () => {
        const auth = algo25('S')
        const a = watch('A', 'S')
        expect(getSignerFor('A', [a, auth], ALGORAND_CHAIN_ID)).toBe(auth)
    })

    it('returns the auth account when rekeyed to a hardware account', () => {
        const auth = hardware('S')
        const a = watch('A', 'S')
        expect(getSignerFor('A', [a, auth], ALGORAND_CHAIN_ID)).toBe(auth)
    })

    it('returns the auth multisig when rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(getSignerFor('A', [a, ms, participant], ALGORAND_CHAIN_ID)).toBe(
            ms,
        )
    })

    it('returns null when rekeyed to a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(getSignerFor('A', [a, ms], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns null when rekeyed to an account we cannot sign with', () => {
        const auth = watch('S')
        const a = watch('A', 'S')
        expect(getSignerFor('A', [a, auth], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns null when the rekey target is unknown locally', () => {
        const a = watch('A', 'MISSING')
        expect(getSignerFor('A', [a], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns the multisig itself when at least one participant is local + signable', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms, participant], ALGORAND_CHAIN_ID)).toBe(ms)
    })

    it('returns null for a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('counts a hardware participant in a multisig', () => {
        const participant = hardware('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms, participant], ALGORAND_CHAIN_ID)).toBe(ms)
    })

    it('counts a rekeyed participant as signable — slots are bound to own key', () => {
        // The participant being rekeyed itself doesn't matter; the multisig
        // slot is bound to the participant's own pubkey.
        const participant = rekeyedTo(algo25('P1'), 'ELSEWHERE')
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms, participant], ALGORAND_CHAIN_ID)).toBe(ms)
    })

    it('is single-hop — does not chase A → B → C even if C can sign', () => {
        // Both A and B hold no key. Following B's auth-addr to C is not done.
        const a = watch('A', 'B')
        const b = watch('B', 'C')
        const c = algo25('C')
        expect(getSignerFor('A', [a, b, c], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('does not infinite-loop on a cyclic auth chain (A → B → A)', () => {
        const a = watch('A', 'B')
        const b = watch('B', 'A')
        expect(getSignerFor('A', [a, b], ALGORAND_CHAIN_ID)).toBeNull()
    })
})

describe('canSignWith', () => {
    it('returns true for accounts holding their own key', () => {
        const a = algo25('A')
        expect(canSignWith(a, [a], ALGORAND_CHAIN_ID)).toBe(true)
    })

    it('returns true for hardware accounts even with no keyPairId', () => {
        const a = hardware('A')
        expect(canSignWith(a, [a], ALGORAND_CHAIN_ID)).toBe(true)
    })

    it('returns false for non-rekeyed watch accounts', () => {
        const a = watch('A')
        expect(canSignWith(a, [a], ALGORAND_CHAIN_ID)).toBe(false)
    })

    it('returns true when rekeyed to a signable auth account', () => {
        const auth = algo25('S')
        const a = watch('A', 'S')
        expect(canSignWith(a, [a, auth], ALGORAND_CHAIN_ID)).toBe(true)
    })

    it('returns true when rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(canSignWith(a, [a, ms, participant], ALGORAND_CHAIN_ID)).toBe(
            true,
        )
    })

    it('returns false when rekeyed to an unsignable multisig', () => {
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(canSignWith(a, [a, ms], ALGORAND_CHAIN_ID)).toBe(false)
    })

    it('returns false when rekeyed but the target is not held', () => {
        const a = watch('A', 'MISSING')
        expect(canSignWith(a, [a], ALGORAND_CHAIN_ID)).toBe(false)
    })

    it('works on an account passed in hand even when not in the accounts list', () => {
        const a = algo25('A')
        // `accounts` is empty — `canSignWith` should still evaluate `a` directly.
        expect(canSignWith(a, [], ALGORAND_CHAIN_ID)).toBe(true)
    })

    it('returns false for a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(canSignWith(ms, [ms], ALGORAND_CHAIN_ID)).toBe(false)
    })

    it('returns true for a multisig with one local signable participant', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(canSignWith(ms, [ms, participant], ALGORAND_CHAIN_ID)).toBe(true)
    })
})

describe('delegateTransitionFor', () => {
    it('returns null for a non-rekeyed account', () => {
        const a = algo25('A')
        expect(delegateTransitionFor(a, [a], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns null when the auth account is missing locally', () => {
        const a: WalletAccount = rekeyedTo(algo25('A'), 'MISSING')
        expect(delegateTransitionFor(a, [a], ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('returns null when the rekey is unsignable', () => {
        const auth = watch('S')
        const a = watch('A', 'S')
        expect(
            delegateTransitionFor(a, [a, auth], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    it('returns the rekeyed account and its signer for a signable algo25 → hardware rekey', () => {
        const auth = hardware('S')
        const a: WalletAccount = rekeyedTo(algo25('A'), 'S')
        expect(delegateTransitionFor(a, [a, auth], ALGORAND_CHAIN_ID)).toEqual({
            from: a,
            to: auth,
        })
    })

    it('returns from/to for a multisig rekeyed to a multisig', () => {
        const participant = algo25('P1')
        const authMs = multisig('M', ['P1', 'P2'])
        const a: WalletAccount = rekeyedTo(multisig('A', ['P1', 'P3']), 'M')
        expect(
            delegateTransitionFor(
                a,
                [a, authMs, participant],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({
            from: a,
            to: authMs,
        })
    })

    it('reports the immediate auth account, not the eventual root', () => {
        // A → B → C; from B's perspective the auth is C. The transition is
        // from algo25 to algo25, regardless of A pointing at B.
        const c = algo25('C')
        const b: WalletAccount = rekeyedTo(algo25('B'), 'C')
        expect(delegateTransitionFor(b, [b, c], ALGORAND_CHAIN_ID)).toEqual({
            from: b,
            to: c,
        })
    })
})

describe('resolveSignerFor', () => {
    it('returns accountNotFound for unknown address', () => {
        expect(resolveSignerFor('UNKNOWN', [], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'accountNotFound',
        })
    })

    it('returns ok for a standard signing account', () => {
        const a = algo25('A')
        expect(resolveSignerFor('A', [a], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'ok',
            signer: a,
        })
    })

    it('returns watch for a non-rekeyed watch account', () => {
        const a = watch('A')
        expect(resolveSignerFor('A', [a], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'watch',
            account: a,
        })
    })

    it('returns authMissing when rekeyed and auth is not in the wallet', () => {
        const a = watch('A', 'MISSING')
        expect(resolveSignerFor('A', [a], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'authMissing',
            account: a,
            authorityAddress: 'MISSING',
        })
    })

    it('returns authIsWatch when rekeyed to a watch account', () => {
        const auth = watch('S')
        const a = watch('A', 'S')
        expect(resolveSignerFor('A', [a, auth], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'authIsWatch',
            account: a,
            auth,
        })
    })

    it('returns authNoLocalParticipant when rekeyed to an unsignable multisig', () => {
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(resolveSignerFor('A', [a, ms], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'authNoLocalParticipant',
            account: a,
            auth: ms,
        })
    })

    it('returns ok when rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(
            resolveSignerFor('A', [a, ms, participant], ALGORAND_CHAIN_ID),
        ).toEqual({
            kind: 'ok',
            signer: ms,
        })
    })

    it('returns noLocalParticipant for a multisig with no local signers', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(resolveSignerFor('M', [ms], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'noLocalParticipant',
            account: ms,
        })
    })
})

describe('isMultisigUnsignable', () => {
    it('returns true for a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(isMultisigUnsignable(ms, [ms], ALGORAND_CHAIN_ID)).toBe(true)
    })

    it('returns false for a multisig with one local signable participant', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(
            isMultisigUnsignable(ms, [ms, participant], ALGORAND_CHAIN_ID),
        ).toBe(false)
    })

    it('returns true when the only local participant is watch-only', () => {
        const participant = watch('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(
            isMultisigUnsignable(ms, [ms, participant], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    it('returns false for a non-multisig account', () => {
        const a = algo25('A')
        expect(isMultisigUnsignable(a, [a], ALGORAND_CHAIN_ID)).toBe(false)
    })

    it('returns true for a multisig rekeyed to an unsignable multisig', () => {
        const authMs = multisig('M', ['P1', 'P2'])
        const a: WalletAccount = rekeyedTo(multisig('A', ['P3', 'P4']), 'M')
        expect(isMultisigUnsignable(a, [a, authMs], ALGORAND_CHAIN_ID)).toBe(
            true,
        )
    })

    it('returns false for a multisig rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const authMs = multisig('M', ['P1', 'P2'])
        const a: WalletAccount = rekeyedTo(multisig('A', ['P3', 'P4']), 'M')
        expect(
            isMultisigUnsignable(
                a,
                [a, authMs, participant],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })
})
