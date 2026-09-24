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
    canSignWith,
    getAuthAccount,
    getRekeyAccount,
    getSignerFor,
    rekeyTransitionFor,
    resolveAuthAccount,
    type SignerResolution,
} from '../signer-resolution'
import { AccountTypes, type WalletAccount } from '../models'
import { RekeyTargetNotFoundError } from '../errors'

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

type SignerCase = {
    name: string
    /** `accounts[0]` is the account under test. */
    accounts: WalletAccount[]
    kind: SignerResolution['kind']
    /** Address of the account that signs, or null. */
    signer: string | null
    /** Address at the auth-addr (self when not rekeyed), or null when unresolvable. */
    auth: string | null
    /** `getRekeyAccount`: the auth only when rekeyed. */
    rekeyAccount: string | null
    isRekeyedUnsignable: boolean
    isMultisigUnsignable: boolean
}

const signerCases: SignerCase[] = [
    {
        name: 'not rekeyed, own local key',
        accounts: [algo25('A')],
        kind: 'ok',
        signer: 'A',
        auth: 'A',
        rekeyAccount: null,
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'not rekeyed, ledger',
        accounts: [hardware('A')],
        kind: 'ok',
        signer: 'A',
        auth: 'A',
        rekeyAccount: null,
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'not rekeyed, quantum',
        accounts: [quantum('A')],
        kind: 'ok',
        signer: 'A',
        auth: 'A',
        rekeyAccount: null,
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'not rekeyed, watch',
        accounts: [watch('A')],
        kind: 'watch',
        signer: null,
        auth: 'A',
        rekeyAccount: null,
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'multisig with a local participant',
        accounts: [multisig('MS', ['P1', 'P2']), algo25('P1')],
        kind: 'ok',
        signer: 'MS',
        auth: 'MS',
        rekeyAccount: null,
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'multisig with no local participant',
        accounts: [multisig('MS', ['P1', 'P2'])],
        kind: 'noLocalParticipant',
        signer: null,
        auth: 'MS',
        rekeyAccount: null,
        isRekeyedUnsignable: false,
        isMultisigUnsignable: true,
    },
    {
        name: 'multisig whose only held participant is quantum',
        accounts: [multisig('MS', ['F1', 'P2']), quantum('F1')],
        kind: 'noLocalParticipant',
        signer: null,
        auth: 'MS',
        rekeyAccount: null,
        isRekeyedUnsignable: false,
        isMultisigUnsignable: true,
    },
    {
        name: 'rekeyed to an owned local account',
        accounts: [watch('A', 'S'), algo25('S')],
        kind: 'ok',
        signer: 'S',
        auth: 'S',
        rekeyAccount: 'S',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'rekeyed to a ledger account',
        accounts: [algo25('A', 'L'), hardware('L')],
        kind: 'ok',
        signer: 'L',
        auth: 'L',
        rekeyAccount: 'L',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'rekeyed to a watch (non-owned) account',
        accounts: [algo25('A', 'W'), watch('W')],
        kind: 'authIsWatch',
        signer: null,
        auth: 'W',
        rekeyAccount: 'W',
        isRekeyedUnsignable: true,
        isMultisigUnsignable: false,
    },
    {
        name: 'rekeyed to a multisig with a local participant',
        accounts: [
            watch('A', 'MS'),
            multisig('MS', ['P1', 'P2']),
            hardware('P1'),
        ],
        kind: 'ok',
        signer: 'MS',
        auth: 'MS',
        rekeyAccount: 'MS',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'rekeyed to a multisig with no local participant',
        accounts: [watch('A', 'MS'), multisig('MS', ['P1', 'P2'])],
        kind: 'authNoLocalParticipant',
        signer: null,
        auth: 'MS',
        rekeyAccount: 'MS',
        isRekeyedUnsignable: true,
        isMultisigUnsignable: false,
    },
    {
        name: 'rekeyed to a quantum account',
        accounts: [algo25('A', 'F'), quantum('F')],
        kind: 'ok',
        signer: 'F',
        auth: 'F',
        rekeyAccount: 'F',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'auth account missing from the store',
        accounts: [watch('A', 'GONE')],
        kind: 'authMissing',
        signer: null,
        auth: null,
        rekeyAccount: null,
        isRekeyedUnsignable: true,
        isMultisigUnsignable: false,
    },
    {
        name: 'auth missing while the account still holds its own key',
        accounts: [algo25('A', 'GONE')],
        kind: 'authMissing',
        signer: null,
        auth: null,
        rekeyAccount: null,
        isRekeyedUnsignable: true,
        isMultisigUnsignable: false,
    },
    {
        name: 'rekeyed to itself, own key',
        accounts: [algo25('A', 'A')],
        kind: 'ok',
        signer: 'A',
        auth: 'A',
        rekeyAccount: 'A',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'rekeyed to itself, watch',
        accounts: [watch('A', 'A')],
        kind: 'authIsWatch',
        signer: null,
        auth: 'A',
        rekeyAccount: 'A',
        isRekeyedUnsignable: true,
        isMultisigUnsignable: false,
    },
    {
        name: 'circular rekey (A→B, B→A) stops after one hop',
        accounts: [algo25('A', 'B'), algo25('B', 'A')],
        kind: 'ok',
        signer: 'B',
        auth: 'B',
        rekeyAccount: 'B',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'multi-hop (A→B→C): C is not followed when B holds no key',
        accounts: [watch('A', 'B'), watch('B', 'C'), algo25('C')],
        kind: 'authIsWatch',
        signer: null,
        auth: 'B',
        rekeyAccount: 'B',
        isRekeyedUnsignable: true,
        isMultisigUnsignable: false,
    },
    {
        name: "multi-hop (A→B→C): B signs with its own key despite B's rekey",
        accounts: [watch('A', 'B'), algo25('B', 'C'), algo25('C')],
        kind: 'ok',
        signer: 'B',
        auth: 'B',
        rekeyAccount: 'B',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
    {
        name: 'multisig itself rekeyed to a local account',
        accounts: [multisig('MS', ['P1', 'P2'], 'S'), algo25('S')],
        kind: 'ok',
        signer: 'S',
        auth: 'S',
        rekeyAccount: 'S',
        isRekeyedUnsignable: false,
        isMultisigUnsignable: false,
    },
]

describe.each(signerCases)('signer resolution: $name', c => {
    const account = c.accounts[0]
    const address = account.address as string

    it('resolves the expected kind by account and by address', () => {
        expect(resolveSignerForAccount(account, c.accounts).kind).toBe(c.kind)
        expect(resolveSignerFor(address, c.accounts).kind).toBe(c.kind)
    })

    it('derives the signer and boolean forms from that kind', () => {
        expect(getSignerFor(address, c.accounts)?.address ?? null).toBe(
            c.signer,
        )
        expect(canSignWith(account, c.accounts)).toBe(c.signer !== null)
        expect(canInitiateRekey(account, c.accounts)).toBe(c.signer !== null)
        expect(isRekeyedUnsignable(account, c.accounts)).toBe(
            c.isRekeyedUnsignable,
        )
        expect(isMultisigUnsignable(account, c.accounts)).toBe(
            c.isMultisigUnsignable,
        )
    })

    it('derives the auth-account forms', () => {
        expect(getAuthAccount(account, c.accounts)?.address ?? null).toBe(
            c.auth,
        )
        expect(getRekeyAccount(address, c.accounts)?.address ?? null).toBe(
            c.rekeyAccount,
        )
        if (c.auth === null) {
            expect(() => resolveAuthAccount(account, c.accounts)).toThrow(
                RekeyTargetNotFoundError,
            )
        } else {
            expect(resolveAuthAccount(account, c.accounts).address).toBe(c.auth)
        }
    })

    it('reports a rekey transition only for a signable rekeyed account', () => {
        const signerType = c.accounts.find(a => a.address === c.signer)?.type
        const expected =
            account.rekeyAddress && signerType
                ? { from: account.type, to: signerType }
                : null
        expect(rekeyTransitionFor(account, c.accounts)).toEqual(expected)
    })
})

describe('signer resolution: account not in the store', () => {
    const accounts = [algo25('A')]

    it('address forms report accountNotFound / null', () => {
        expect(resolveSignerFor('Z', accounts)).toEqual({
            kind: 'accountNotFound',
        })
        expect(getSignerFor('Z', accounts)).toBeNull()
        expect(getRekeyAccount('Z', accounts)).toBeNull()
    })

    it('account-in-hand forms resolve without the account being stored', () => {
        const outsider = watch('Z', 'A')
        expect(canSignWith(outsider, accounts)).toBe(true)
        expect(resolveAuthAccount(outsider, accounts).address).toBe('A')
    })
})

describe('auth-account forms on a legacy multisig record without multisigDetails', () => {
    const legacy = {
        type: AccountTypes.multisig,
        address: 'MS',
    } as WalletAccount

    it('resolve the auth hop without evaluating participants', () => {
        expect(resolveAuthAccount(legacy, [legacy])).toBe(legacy)
        expect(getAuthAccount(legacy, [legacy])).toBe(legacy)
    })

    it('follow a rekey to a legacy multisig auth', () => {
        const account = watch('A', 'MS')
        expect(resolveAuthAccount(account, [account, legacy])).toBe(legacy)
        expect(getRekeyAccount('A', [account, legacy])).toBe(legacy)
    })
})

describe('resolveAuthAccount error payload', () => {
    it('names the missing rekey target', () => {
        const account = watch('A', 'GONE')
        expect(() => resolveAuthAccount(account, [account])).toThrow(
            'Rekey target account GONE not found in local accounts',
        )
    })
})
