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

import { describe, it, expect } from 'vitest'
import {
    resolveSignerFor,
    resolveSignerForAccount,
    isRekeyedUnsignable,
    isMultisigUnsignable,
    canInitiateRekey,
} from '../utils'
import { AccountTypes, type WalletAccount } from '../models'

const algo25 = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        type: AccountTypes.algo25,
        address,
        keyPairId: `kp-${address}`,
        ...(rekeyAddress ? { rekeyAddress } : {}),
    }) as WalletAccount

const watch = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        type: AccountTypes.watch,
        address,
        ...(rekeyAddress ? { rekeyAddress } : {}),
    }) as WalletAccount

const hardware = (address: string): WalletAccount =>
    ({ type: AccountTypes.hardware, address }) as WalletAccount

const quantum = (address: string, rekeyAddress?: string): WalletAccount =>
    ({
        type: AccountTypes.quantum,
        address,
        keyPairId: `kp-${address}`,
        ...(rekeyAddress ? { rekeyAddress } : {}),
    }) as WalletAccount

const multisig = (
    address: string,
    participantAddresses: string[],
    rekeyAddress?: string,
): WalletAccount =>
    ({
        type: AccountTypes.multisig,
        address,
        multisigDetails: {
            threshold: 2,
            addresses: participantAddresses,
            version: 1,
        },
        ...(rekeyAddress ? { rekeyAddress } : {}),
    }) as WalletAccount

describe('resolveSignerForAccount — tagged resolution', () => {
    it('kind="ok" for a standard account holding its own key', () => {
        const account = algo25('A')
        expect(resolveSignerForAccount(account, [account])).toEqual({
            kind: 'ok',
            signer: account,
        })
    })

    it('kind="watch" for a non-rekeyed watch account', () => {
        const account = watch('A')
        expect(resolveSignerForAccount(account, [account])).toEqual({
            kind: 'watch',
            account,
        })
    })

    it('kind="authMissing" when the rekey target is not held locally', () => {
        const account = watch('A', 'GONE')
        expect(resolveSignerForAccount(account, [account])).toEqual({
            kind: 'authMissing',
            account,
            authAddress: 'GONE',
        })
    })

    it('kind="authIsWatch" when the auth account cannot sign directly', () => {
        const auth = watch('W')
        const account = watch('A', 'W')
        expect(resolveSignerForAccount(account, [account, auth])).toEqual({
            kind: 'authIsWatch',
            account,
            auth,
        })
    })

    it('kind="ok" with the auth as signer when rekeyed to a signable account', () => {
        const auth = algo25('S')
        const account = watch('A', 'S')
        expect(resolveSignerForAccount(account, [account, auth])).toEqual({
            kind: 'ok',
            signer: auth,
        })
    })

    it('kind="ok" when rekeyed to a multisig with a local signable participant', () => {
        const participant = algo25('P1')
        const auth = multisig('MS', ['P1', 'P2'])
        const account = watch('A', 'MS')
        expect(
            resolveSignerForAccount(account, [account, auth, participant]),
        ).toEqual({ kind: 'ok', signer: auth })
    })

    it('kind="authNoLocalParticipant" when rekeyed to an unsignable multisig', () => {
        const auth = multisig('MS', ['P1', 'P2'])
        const account = watch('A', 'MS')
        expect(resolveSignerForAccount(account, [account, auth])).toEqual({
            kind: 'authNoLocalParticipant',
            account,
            auth,
        })
    })

    it('kind="ok" for a multisig with a local signable participant', () => {
        const participant = hardware('P1')
        const account = multisig('MS', ['P1', 'P2'])
        expect(
            resolveSignerForAccount(account, [account, participant]),
        ).toEqual({ kind: 'ok', signer: account })
    })

    it('kind="ok" for a quantum account holding its own key', () => {
        const account = quantum('F')
        expect(resolveSignerForAccount(account, [account])).toEqual({
            kind: 'ok',
            signer: account,
        })
    })

    it('kind="ok" with a quantum auth as signer for a rekeyed account', () => {
        const auth = quantum('FAUTH')
        const account = watch('A', 'FAUTH')
        expect(resolveSignerForAccount(account, [account, auth])).toEqual({
            kind: 'ok',
            signer: auth,
        })
    })

    it('kind="noLocalParticipant" when a multisig\'s only held participant is quantum (Ed25519-only protocol)', () => {
        const participant = quantum('F1')
        const account = multisig('M', ['F1', 'P2'])
        expect(
            resolveSignerForAccount(account, [account, participant]),
        ).toEqual({ kind: 'noLocalParticipant', account })
    })

    it('kind="noLocalParticipant" for a multisig with no local signable participant', () => {
        const account = multisig('MS', ['P1', 'P2'])
        expect(resolveSignerForAccount(account, [account])).toEqual({
            kind: 'noLocalParticipant',
            account,
        })
    })
})

describe('resolveSignerFor — by address', () => {
    it('kind="accountNotFound" when the address is not in the wallet', () => {
        expect(resolveSignerFor('Z', [algo25('A')])).toEqual({
            kind: 'accountNotFound',
        })
    })

    it('delegates to resolveSignerForAccount for a known address', () => {
        const account = algo25('A')
        expect(resolveSignerFor('A', [account])).toEqual({
            kind: 'ok',
            signer: account,
        })
    })
})

describe('isRekeyedUnsignable', () => {
    it('false for a non-rekeyed account', () => {
        const account = algo25('A')
        expect(isRekeyedUnsignable(account, [account])).toBe(false)
    })

    it('false when rekeyed to a signable auth account', () => {
        const auth = algo25('S')
        const account = watch('A', 'S')
        expect(isRekeyedUnsignable(account, [account, auth])).toBe(false)
    })

    it('true when rekeyed to a watch auth account', () => {
        const auth = watch('W')
        const account = watch('A', 'W')
        expect(isRekeyedUnsignable(account, [account, auth])).toBe(true)
    })

    it('true when the rekey target is missing locally', () => {
        const account = watch('A', 'GONE')
        expect(isRekeyedUnsignable(account, [account])).toBe(true)
    })

    it('true when rekeyed to a multisig with no local signable participant', () => {
        const auth = multisig('MS', ['P1', 'P2'])
        const account = watch('A', 'MS')
        expect(isRekeyedUnsignable(account, [account, auth])).toBe(true)
    })
})

describe('isMultisigUnsignable', () => {
    it('false for a non-multisig account', () => {
        const account = algo25('A')
        expect(isMultisigUnsignable(account, [account])).toBe(false)
    })

    it('false for a multisig with a local signable participant', () => {
        const participant = algo25('P1')
        const account = multisig('MS', ['P1', 'P2'])
        expect(isMultisigUnsignable(account, [account, participant])).toBe(
            false,
        )
    })

    it('true for a multisig with no local signable participant', () => {
        const account = multisig('MS', ['P1', 'P2'])
        expect(isMultisigUnsignable(account, [account])).toBe(true)
    })
})

describe('canInitiateRekey', () => {
    it('true for a signable standard account', () => {
        const account = algo25('A')
        expect(canInitiateRekey(account, [account])).toBe(true)
    })

    it('false for a watch account', () => {
        const account = watch('A')
        expect(canInitiateRekey(account, [account])).toBe(false)
    })

    it('true for a watch account rekeyed to a signable auth (auth chain signs the rekey)', () => {
        const auth = algo25('S')
        const account = watch('A', 'S')
        expect(canInitiateRekey(account, [account, auth])).toBe(true)
    })
})
