/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, it } from 'vitest'
import {
    canInitiateRekey,
    canSignArbitraryData,
    canSignWith,
    getRekeyAccount,
    getSignerFor,
    isMultisigUnsignable,
    isRekeyedUnsignable,
    rekeyTransitionFor,
    resolveSignerFor,
} from '../utils'
import {
    AccountTypes,
    type Algo25Account,
    type HDWalletAccount,
    type HardwareWalletAccount,
    type MultiSigAccount,
    type WatchAccount,
    type WalletAccount,
} from '../models'

const algo25 = (
    address: string,
    extra: Partial<Algo25Account> = {},
): Algo25Account => ({
    type: AccountTypes.algo25,
    address,
    keyPairId: 'kp',
    ...extra,
})

const hdWallet = (
    address: string,
    extra: Partial<HDWalletAccount> = {},
): HDWalletAccount => ({
    type: AccountTypes.hdWallet,
    address,
    keyPairId: 'kp',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 32,
    },
    ...extra,
})

const hardware = (
    address: string,
    extra: Partial<HardwareWalletAccount> = {},
): HardwareWalletAccount => ({
    type: AccountTypes.hardware,
    address,
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'd',
        deviceName: 'Ledger',
        accountIndex: 0,
        transportType: 'ble',
    },
    ...extra,
})

const multisig = (
    address: string,
    participants: string[],
    extra: Partial<MultiSigAccount> = {},
): MultiSigAccount => ({
    type: AccountTypes.multisig,
    address,
    multisigDetails: { threshold: 2, addresses: participants },
    ...extra,
})

const watch = (address: string, rekeyAddress?: string): WatchAccount => ({
    type: AccountTypes.watch,
    address,
    rekeyAddress,
})

describe('getRekeyAccount', () => {
    it('returns null when the address is not in the wallet', () => {
        expect(getRekeyAccount('Z', [algo25('A')])).toBeNull()
    })

    it('returns null when the account has no rekey', () => {
        const a = algo25('A')
        expect(getRekeyAccount('A', [a])).toBeNull()
    })

    it('returns the auth account when the target is held', () => {
        const auth = algo25('AUTH')
        const a = algo25('A', { rekeyAddress: 'AUTH' })
        expect(getRekeyAccount('A', [a, auth])).toBe(auth)
    })

    it('returns null when the auth target is unknown locally', () => {
        const a = algo25('A', { rekeyAddress: 'MISSING' })
        expect(getRekeyAccount('A', [a])).toBeNull()
    })

    it('reports the immediate auth — does not follow chains', () => {
        const mid = algo25('B', { rekeyAddress: 'C' })
        const a = algo25('A', { rekeyAddress: 'B' })
        const c = algo25('C')
        expect(getRekeyAccount('A', [a, mid, c])).toBe(mid)
    })
})

describe('getSignerFor', () => {
    it('returns null for an unknown address', () => {
        expect(getSignerFor('UNKNOWN', [])).toBeNull()
    })

    it('returns the account itself for a standard signing account', () => {
        const a = algo25('A')
        expect(getSignerFor('A', [a])).toBe(a)
    })

    it('returns the account itself for an HD wallet account', () => {
        const a = hdWallet('A')
        expect(getSignerFor('A', [a])).toBe(a)
    })

    it('returns the account itself for a hardware account (no keyPairId)', () => {
        const a = hardware('A')
        expect(getSignerFor('A', [a])).toBe(a)
    })

    it('returns null for a non-rekeyed watch account', () => {
        const a = watch('A')
        expect(getSignerFor('A', [a])).toBeNull()
    })

    it('returns the auth account when rekeyed to a signable algo25', () => {
        const auth = algo25('S')
        const a = watch('A', 'S')
        expect(getSignerFor('A', [a, auth])).toBe(auth)
    })

    it('returns the auth account when rekeyed to a hardware account', () => {
        const auth = hardware('S')
        const a = watch('A', 'S')
        expect(getSignerFor('A', [a, auth])).toBe(auth)
    })

    it('returns the auth multisig when rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(getSignerFor('A', [a, ms, participant])).toBe(ms)
    })

    it('returns null when rekeyed to a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(getSignerFor('A', [a, ms])).toBeNull()
    })

    it('returns null when rekeyed to an account we cannot sign with', () => {
        const auth = watch('S')
        const a = watch('A', 'S')
        expect(getSignerFor('A', [a, auth])).toBeNull()
    })

    it('returns null when the rekey target is unknown locally', () => {
        const a = watch('A', 'MISSING')
        expect(getSignerFor('A', [a])).toBeNull()
    })

    it('returns the multisig itself when at least one participant is local + signable', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms, participant])).toBe(ms)
    })

    it('returns null for a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms])).toBeNull()
    })

    it('counts a hardware participant in a multisig', () => {
        const participant = hardware('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms, participant])).toBe(ms)
    })

    it('counts a rekeyed participant as signable — slots are bound to own key', () => {
        // The participant being rekeyed itself doesn't matter; the multisig
        // slot is bound to the participant's own pubkey.
        const participant = algo25('P1', { rekeyAddress: 'ELSEWHERE' })
        const ms = multisig('M', ['P1', 'P2'])
        expect(getSignerFor('M', [ms, participant])).toBe(ms)
    })

    it('is single-hop — does not chase A → B → C even if C can sign', () => {
        // Both A and B hold no key. Following B's auth-addr to C is not done.
        const a = watch('A', 'B')
        const b = watch('B', 'C')
        const c = algo25('C')
        expect(getSignerFor('A', [a, b, c])).toBeNull()
    })

    it('does not infinite-loop on a cyclic auth chain (A → B → A)', () => {
        const a = watch('A', 'B')
        const b = watch('B', 'A')
        expect(getSignerFor('A', [a, b])).toBeNull()
    })
})

describe('canSignWith', () => {
    it('returns true for accounts holding their own key', () => {
        const a = algo25('A')
        expect(canSignWith(a, [a])).toBe(true)
    })

    it('returns true for hardware accounts even with no keyPairId', () => {
        const a = hardware('A')
        expect(canSignWith(a, [a])).toBe(true)
    })

    it('returns false for non-rekeyed watch accounts', () => {
        const a = watch('A')
        expect(canSignWith(a, [a])).toBe(false)
    })

    it('returns true when rekeyed to a signable auth account', () => {
        const auth = algo25('S')
        const a = watch('A', 'S')
        expect(canSignWith(a, [a, auth])).toBe(true)
    })

    it('returns true when rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(canSignWith(a, [a, ms, participant])).toBe(true)
    })

    it('returns false when rekeyed to an unsignable multisig', () => {
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(canSignWith(a, [a, ms])).toBe(false)
    })

    it('returns false when rekeyed but the target is not held', () => {
        const a = watch('A', 'MISSING')
        expect(canSignWith(a, [a])).toBe(false)
    })

    it('works on an account passed in hand even when not in the accounts list', () => {
        const a = algo25('A')
        // `accounts` is empty — `canSignWith` should still evaluate `a` directly.
        expect(canSignWith(a, [])).toBe(true)
    })

    it('returns false for a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(canSignWith(ms, [ms])).toBe(false)
    })

    it('returns true for a multisig with one local signable participant', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(canSignWith(ms, [ms, participant])).toBe(true)
    })
})

describe('rekeyTransitionFor', () => {
    it('returns null for a non-rekeyed account', () => {
        const a = algo25('A')
        expect(rekeyTransitionFor(a, [a])).toBeNull()
    })

    it('returns null when the auth account is missing locally', () => {
        const a: WalletAccount = { ...algo25('A'), rekeyAddress: 'MISSING' }
        expect(rekeyTransitionFor(a, [a])).toBeNull()
    })

    it('returns null when the rekey is unsignable', () => {
        const auth = watch('S')
        const a = watch('A', 'S')
        expect(rekeyTransitionFor(a, [a, auth])).toBeNull()
    })

    it('returns from/to raw account types for a signable algo25 → hardware rekey', () => {
        const auth = hardware('S')
        const a: WalletAccount = { ...algo25('A'), rekeyAddress: 'S' }
        expect(rekeyTransitionFor(a, [a, auth])).toEqual({
            from: AccountTypes.algo25,
            to: AccountTypes.hardware,
        })
    })

    it('returns from/to for a multisig rekeyed to a multisig', () => {
        const participant = algo25('P1')
        const authMs = multisig('M', ['P1', 'P2'])
        const a: MultiSigAccount = {
            ...multisig('A', ['P1', 'P3']),
            rekeyAddress: 'M',
        }
        expect(rekeyTransitionFor(a, [a, authMs, participant])).toEqual({
            from: AccountTypes.multisig,
            to: AccountTypes.multisig,
        })
    })

    it('reports the immediate auth account, not the eventual root', () => {
        // A → B → C; from B's perspective the auth is C. The transition is
        // from algo25 to algo25, regardless of A pointing at B.
        const c = algo25('C')
        const b: WalletAccount = { ...algo25('B'), rekeyAddress: 'C' }
        expect(rekeyTransitionFor(b, [b, c])).toEqual({
            from: AccountTypes.algo25,
            to: AccountTypes.algo25,
        })
    })
})

describe('resolveSignerFor', () => {
    it('returns accountNotFound for unknown address', () => {
        expect(resolveSignerFor('UNKNOWN', [])).toEqual({
            kind: 'accountNotFound',
        })
    })

    it('returns ok for a standard signing account', () => {
        const a = algo25('A')
        expect(resolveSignerFor('A', [a])).toEqual({ kind: 'ok', signer: a })
    })

    it('returns watch for a non-rekeyed watch account', () => {
        const a = watch('A')
        expect(resolveSignerFor('A', [a])).toEqual({
            kind: 'watch',
            account: a,
        })
    })

    it('returns authMissing when rekeyed and auth is not in the wallet', () => {
        const a = watch('A', 'MISSING')
        expect(resolveSignerFor('A', [a])).toEqual({
            kind: 'authMissing',
            account: a,
            authAddress: 'MISSING',
        })
    })

    it('returns authIsWatch when rekeyed to a watch account', () => {
        const auth = watch('S')
        const a = watch('A', 'S')
        expect(resolveSignerFor('A', [a, auth])).toEqual({
            kind: 'authIsWatch',
            account: a,
            auth,
        })
    })

    it('returns authNoLocalParticipant when rekeyed to an unsignable multisig', () => {
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(resolveSignerFor('A', [a, ms])).toEqual({
            kind: 'authNoLocalParticipant',
            account: a,
            auth: ms,
        })
    })

    it('returns ok when rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(resolveSignerFor('A', [a, ms, participant])).toEqual({
            kind: 'ok',
            signer: ms,
        })
    })

    it('returns noLocalParticipant for a multisig with no local signers', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(resolveSignerFor('M', [ms])).toEqual({
            kind: 'noLocalParticipant',
            account: ms,
        })
    })
})

describe('canSignArbitraryData', () => {
    it('returns true for a standard algo25', () => {
        const a = algo25('A')
        expect(canSignArbitraryData(a)).toBe(true)
    })

    it('returns true for an HD wallet account', () => {
        const a = hdWallet('A')
        expect(canSignArbitraryData(a)).toBe(true)
    })

    it('returns false for a hardware wallet — Ledger has no raw-byte opcode', () => {
        const a = hardware('A')
        expect(canSignArbitraryData(a)).toBe(false)
    })

    it('returns false for a multisig — no multisig signature shape for raw data', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(canSignArbitraryData(ms)).toBe(false)
    })

    it('returns false for watch accounts', () => {
        const a = watch('A')
        expect(canSignArbitraryData(a)).toBe(false)
    })

    it('returns true for an algo25/HD even if rekeyed — own keypair still signs', () => {
        // The dApp verifies the signature against the requested address's
        // own pubkey; the on-chain auth-addr is irrelevant for off-chain
        // data. Holding the account's own keypair is sufficient.
        const a: WalletAccount = { ...algo25('A'), rekeyAddress: 'S' }
        expect(canSignArbitraryData(a)).toBe(true)
    })

    it('returns false for a watch-rekeyed account regardless of auth', () => {
        // We hold the auth account, but the dApp expects a signature from
        // the watch address's pubkey — which we never had.
        const a = watch('A', 'S')
        expect(canSignArbitraryData(a)).toBe(false)
    })
})

describe('isRekeyedUnsignable', () => {
    it('returns false for non-rekeyed accounts', () => {
        const a = algo25('A')
        expect(isRekeyedUnsignable(a, [a])).toBe(false)
    })

    it('returns false for non-rekeyed watch accounts', () => {
        // A pure watch is NOT rekeyed-unsignable. UI should use
        // isWatchAccount for that case.
        const a = watch('A')
        expect(isRekeyedUnsignable(a, [a])).toBe(false)
    })

    it('returns true when rekeyed and auth is missing locally', () => {
        const a = watch('A', 'MISSING')
        expect(isRekeyedUnsignable(a, [a])).toBe(true)
    })

    it('returns true when rekeyed to a watch', () => {
        const auth = watch('S')
        const a = watch('A', 'S')
        expect(isRekeyedUnsignable(a, [a, auth])).toBe(true)
    })

    it('returns true when rekeyed to an unsignable multisig', () => {
        const ms = multisig('M', ['P1', 'P2'])
        const a = watch('A', 'M')
        expect(isRekeyedUnsignable(a, [a, ms])).toBe(true)
    })

    it('returns false when rekeyed to a signable account', () => {
        const auth = algo25('S')
        const a = watch('A', 'S')
        expect(isRekeyedUnsignable(a, [a, auth])).toBe(false)
    })
})

describe('isMultisigUnsignable', () => {
    it('returns true for a multisig with no local participants', () => {
        const ms = multisig('M', ['P1', 'P2'])
        expect(isMultisigUnsignable(ms, [ms])).toBe(true)
    })

    it('returns false for a multisig with one local signable participant', () => {
        const participant = algo25('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(isMultisigUnsignable(ms, [ms, participant])).toBe(false)
    })

    it('returns true when the only local participant is watch-only', () => {
        const participant = watch('P1')
        const ms = multisig('M', ['P1', 'P2'])
        expect(isMultisigUnsignable(ms, [ms, participant])).toBe(true)
    })

    it('returns false for a non-multisig account', () => {
        const a = algo25('A')
        expect(isMultisigUnsignable(a, [a])).toBe(false)
    })

    it('returns true for a multisig rekeyed to an unsignable multisig', () => {
        const authMs = multisig('M', ['P1', 'P2'])
        const a: MultiSigAccount = {
            ...multisig('A', ['P3', 'P4']),
            rekeyAddress: 'M',
        }
        expect(isMultisigUnsignable(a, [a, authMs])).toBe(true)
    })

    it('returns false for a multisig rekeyed to a signable multisig', () => {
        const participant = algo25('P1')
        const authMs = multisig('M', ['P1', 'P2'])
        const a: MultiSigAccount = {
            ...multisig('A', ['P3', 'P4']),
            rekeyAddress: 'M',
        }
        expect(isMultisigUnsignable(a, [a, authMs, participant])).toBe(false)
    })
})

describe('canInitiateRekey', () => {
    it('matches canSignWith — same condition under a clearer name', () => {
        const auth = algo25('S')
        const a = watch('A', 'S')
        const accounts: WalletAccount[] = [a, auth]
        expect(canInitiateRekey(a, accounts)).toBe(canSignWith(a, accounts))
        expect(canInitiateRekey(auth, accounts)).toBe(
            canSignWith(auth, accounts),
        )
    })

    it('returns true for an already-rekeyed account whose auth we hold', () => {
        // The re-rekey would be signed by the existing auth chain.
        const auth = algo25('S')
        const a = watch('A', 'S')
        expect(canInitiateRekey(a, [a, auth])).toBe(true)
    })

    it('returns false for a stranded rekey (auth missing)', () => {
        const a = watch('A', 'MISSING')
        expect(canInitiateRekey(a, [a])).toBe(false)
    })

    it('returns false for a pure watch account', () => {
        const a = watch('A')
        expect(canInitiateRekey(a, [a])).toBe(false)
    })
})
