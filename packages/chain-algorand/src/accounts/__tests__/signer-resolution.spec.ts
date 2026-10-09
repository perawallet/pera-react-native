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

import { beforeAll, beforeEach, describe, it, expect } from 'vitest'
import {
    accountsChainAdapters,
    resolveSignerFor,
    resolveSignerForAccount,
    isRekeyedUnsignable,
    isMultisigUnsignable,
    canSignWith,
    getAuthAccount,
    getRekeyAccount,
    getSignerFor,
    delegateTransitionFor,
    resolveAuthAccount,
    useAccountChainStateStore,
    DelegationTargetNotFoundError,
    type SignerResolution,
    type WalletAccount,
    accountType,
} from '@perawallet/wallet-core-accounts'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandAccountsAdapter } from '../adapter'
import { seedAuthority } from './seedAuthority'

beforeAll(() => {
    accountsChainAdapters.reset()
    accountsChainAdapters.register(algorandAccountsAdapter)
})

beforeEach(() => {
    useAccountChainStateStore.getState().resetState()
})

// The case table builds accounts before any test runs, so each builder
// records its authority for `seedAuthorities` to replay after the reset.
const authorities = new WeakMap<WalletAccount, string>()

const withAuthority = (
    account: WalletAccount,
    authority?: string,
): WalletAccount => {
    if (authority) {
        authorities.set(account, authority)
        seedAuthority(account.address as string, authority)
    }
    return account
}

const seedAuthorities = (accounts: WalletAccount[]): void => {
    for (const account of accounts) {
        const authority = authorities.get(account)
        if (authority) seedAuthority(account.address as string, authority)
    }
}

const algo25 = (address: string, authority?: string): WalletAccount =>
    withAuthority(
        {
            custody: { kind: 'local', seed: null },
            address,
            keyPairId: `kp-${address}`,
        } as WalletAccount,
        authority,
    )

const watch = (address: string, authority?: string): WalletAccount =>
    withAuthority(
        { custody: { kind: 'watch' }, address } as WalletAccount,
        authority,
    )

const hardware = (address: string): WalletAccount =>
    ({
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
        address,
    }) as WalletAccount

const quantum = (address: string, authority?: string): WalletAccount =>
    withAuthority(
        {
            custody: { kind: 'local', seed: 'quantum' },
            address,
            keyPairId: `kp-${address}`,
        } as WalletAccount,
        authority,
    )

const multisig = (
    address: string,
    participantAddresses: string[],
    authority?: string,
): WalletAccount =>
    withAuthority(
        {
            custody: { kind: 'multisig' },
            address,
            multisigDetails: {
                threshold: 2,
                addresses: participantAddresses,
                version: 1,
            },
        } as WalletAccount,
        authority,
    )

describe('resolveSignerForAccount — tagged resolution', () => {
    it('kind="ok" for a standard account holding its own key', () => {
        const account = algo25('A')
        expect(
            resolveSignerForAccount(account, [account], ALGORAND_CHAIN_ID),
        ).toEqual({
            kind: 'ok',
            signer: account,
        })
    })

    it('kind="watch" for a non-rekeyed watch account', () => {
        const account = watch('A')
        expect(
            resolveSignerForAccount(account, [account], ALGORAND_CHAIN_ID),
        ).toEqual({
            kind: 'watch',
            account,
        })
    })

    it('kind="authMissing" when the rekey target is not held locally', () => {
        const account = watch('A', 'GONE')
        expect(
            resolveSignerForAccount(account, [account], ALGORAND_CHAIN_ID),
        ).toEqual({
            kind: 'authMissing',
            account,
            authorityAddress: 'GONE',
        })
    })

    it('kind="authIsWatch" when the auth account cannot sign directly', () => {
        const auth = watch('W')
        const account = watch('A', 'W')
        expect(
            resolveSignerForAccount(
                account,
                [account, auth],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({
            kind: 'authIsWatch',
            account,
            auth,
        })
    })

    it('kind="ok" with the auth as signer when rekeyed to a signable account', () => {
        const auth = algo25('S')
        const account = watch('A', 'S')
        expect(
            resolveSignerForAccount(
                account,
                [account, auth],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({
            kind: 'ok',
            signer: auth,
        })
    })

    it('kind="ok" when rekeyed to a multisig with a local signable participant', () => {
        const participant = algo25('P1')
        const auth = multisig('MS', ['P1', 'P2'])
        const account = watch('A', 'MS')
        expect(
            resolveSignerForAccount(
                account,
                [account, auth, participant],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({ kind: 'ok', signer: auth })
    })

    it('kind="authNoLocalParticipant" when rekeyed to an unsignable multisig', () => {
        const auth = multisig('MS', ['P1', 'P2'])
        const account = watch('A', 'MS')
        expect(
            resolveSignerForAccount(
                account,
                [account, auth],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({
            kind: 'authNoLocalParticipant',
            account,
            auth,
        })
    })

    it('kind="ok" for a multisig with a local signable participant', () => {
        const participant = hardware('P1')
        const account = multisig('MS', ['P1', 'P2'])
        expect(
            resolveSignerForAccount(
                account,
                [account, participant],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({ kind: 'ok', signer: account })
    })

    it('kind="ok" for a quantum account holding its own key', () => {
        const account = quantum('F')
        expect(
            resolveSignerForAccount(account, [account], ALGORAND_CHAIN_ID),
        ).toEqual({
            kind: 'ok',
            signer: account,
        })
    })

    it('kind="ok" with a quantum auth as signer for a rekeyed account', () => {
        const auth = quantum('FAUTH')
        const account = watch('A', 'FAUTH')
        expect(
            resolveSignerForAccount(
                account,
                [account, auth],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({
            kind: 'ok',
            signer: auth,
        })
    })

    it('kind="noLocalParticipant" when a multisig\'s only held participant is quantum (Ed25519-only protocol)', () => {
        const participant = quantum('F1')
        const account = multisig('M', ['F1', 'P2'])
        expect(
            resolveSignerForAccount(
                account,
                [account, participant],
                ALGORAND_CHAIN_ID,
            ),
        ).toEqual({ kind: 'noLocalParticipant', account })
    })

    it('kind="noLocalParticipant" for a multisig with no local signable participant', () => {
        const account = multisig('MS', ['P1', 'P2'])
        expect(
            resolveSignerForAccount(account, [account], ALGORAND_CHAIN_ID),
        ).toEqual({
            kind: 'noLocalParticipant',
            account,
        })
    })
})

describe('the adapter resolves on the scope it is given', () => {
    const mainnet = scopeForLegacyNetwork('mainnet')
    const testnet = scopeForLegacyNetwork('testnet')

    it('follows the authority recorded for that scope and no other', () => {
        const auth = algo25('S')
        const account = watch('A')
        seedAuthority('A', 'S', testnet)
        const { resolveSigner, getAuthAccount } = algorandAccountsAdapter

        expect(resolveSigner(account, [account, auth], testnet)).toEqual({
            kind: 'ok',
            signer: auth,
        })
        expect(getAuthAccount(account, [account, auth], testnet)).toBe(auth)
        expect(resolveSigner(account, [account, auth], mainnet)).toEqual({
            kind: 'watch',
            account,
        })
        expect(getAuthAccount(account, [account, auth], mainnet)).toBe(account)
    })

    it('names the authority when it is not held', () => {
        const account = watch('A')
        seedAuthority('A', 'GONE', testnet)

        expect(
            algorandAccountsAdapter.resolveSigner(account, [account], testnet),
        ).toEqual({ kind: 'authMissing', account, authorityAddress: 'GONE' })
    })
})

describe('resolveSignerFor — by address', () => {
    it('kind="accountNotFound" when the address is not in the wallet', () => {
        expect(resolveSignerFor('Z', [algo25('A')], ALGORAND_CHAIN_ID)).toEqual(
            {
                kind: 'accountNotFound',
            },
        )
    })

    it('delegates to resolveSignerForAccount for a known address', () => {
        const account = algo25('A')
        expect(resolveSignerFor('A', [account], ALGORAND_CHAIN_ID)).toEqual({
            kind: 'ok',
            signer: account,
        })
    })
})

describe('isRekeyedUnsignable', () => {
    it('false for a non-rekeyed account', () => {
        const account = algo25('A')
        expect(isRekeyedUnsignable(account, [account], ALGORAND_CHAIN_ID)).toBe(
            false,
        )
    })

    it('false when rekeyed to a signable auth account', () => {
        const auth = algo25('S')
        const account = watch('A', 'S')
        expect(
            isRekeyedUnsignable(account, [account, auth], ALGORAND_CHAIN_ID),
        ).toBe(false)
    })

    it('true when rekeyed to a watch auth account', () => {
        const auth = watch('W')
        const account = watch('A', 'W')
        expect(
            isRekeyedUnsignable(account, [account, auth], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    it('true when the rekey target is missing locally', () => {
        const account = watch('A', 'GONE')
        expect(isRekeyedUnsignable(account, [account], ALGORAND_CHAIN_ID)).toBe(
            true,
        )
    })

    it('true when rekeyed to a multisig with no local signable participant', () => {
        const auth = multisig('MS', ['P1', 'P2'])
        const account = watch('A', 'MS')
        expect(
            isRekeyedUnsignable(account, [account, auth], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })
})

describe('isMultisigUnsignable', () => {
    it('false for a non-multisig account', () => {
        const account = algo25('A')
        expect(
            isMultisigUnsignable(account, [account], ALGORAND_CHAIN_ID),
        ).toBe(false)
    })

    it('false for a multisig with a local signable participant', () => {
        const participant = algo25('P1')
        const account = multisig('MS', ['P1', 'P2'])
        expect(
            isMultisigUnsignable(
                account,
                [account, participant],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    it('true for a multisig with no local signable participant', () => {
        const account = multisig('MS', ['P1', 'P2'])
        expect(
            isMultisigUnsignable(account, [account], ALGORAND_CHAIN_ID),
        ).toBe(true)
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

    beforeEach(() => seedAuthorities(c.accounts))

    it('resolves the expected kind by account and by address', () => {
        expect(
            resolveSignerForAccount(account, c.accounts, ALGORAND_CHAIN_ID)
                .kind,
        ).toBe(c.kind)
        expect(
            resolveSignerFor(address, c.accounts, ALGORAND_CHAIN_ID).kind,
        ).toBe(c.kind)
    })

    it('derives the signer and boolean forms from that kind', () => {
        expect(
            getSignerFor(address, c.accounts, ALGORAND_CHAIN_ID)?.address ??
                null,
        ).toBe(c.signer)
        expect(canSignWith(account, c.accounts, ALGORAND_CHAIN_ID)).toBe(
            c.signer !== null,
        )
        expect(
            isRekeyedUnsignable(account, c.accounts, ALGORAND_CHAIN_ID),
        ).toBe(c.isRekeyedUnsignable)
        expect(
            isMultisigUnsignable(account, c.accounts, ALGORAND_CHAIN_ID),
        ).toBe(c.isMultisigUnsignable)
    })

    it('derives the auth-account forms', () => {
        expect(
            getAuthAccount(account, c.accounts, ALGORAND_CHAIN_ID)?.address ??
                null,
        ).toBe(c.auth)
        expect(
            getRekeyAccount(address, c.accounts, ALGORAND_CHAIN_ID)?.address ??
                null,
        ).toBe(c.rekeyAccount)
        if (c.auth === null) {
            expect(() =>
                resolveAuthAccount(account, c.accounts, ALGORAND_CHAIN_ID),
            ).toThrow(DelegationTargetNotFoundError)
        } else {
            expect(
                resolveAuthAccount(account, c.accounts, ALGORAND_CHAIN_ID)
                    .address,
            ).toBe(c.auth)
        }
    })

    it('reports a rekey transition only for a signable rekeyed account', () => {
        const signerType = c.accounts.find(a => a.address === c.signer)
            ? accountType(c.accounts.find(a => a.address === c.signer))
            : undefined
        const expected =
            authorities.has(account) && signerType
                ? { from: accountType(account), to: signerType }
                : null
        expect(
            delegateTransitionFor(account, c.accounts, ALGORAND_CHAIN_ID),
        ).toEqual(expected)
    })
})

describe('signer resolution: account not in the store', () => {
    const accounts = [algo25('A')]

    it('address forms report accountNotFound / null', () => {
        expect(resolveSignerFor('Z', accounts, ALGORAND_CHAIN_ID)).toEqual({
            kind: 'accountNotFound',
        })
        expect(getSignerFor('Z', accounts, ALGORAND_CHAIN_ID)).toBeNull()
        expect(getRekeyAccount('Z', accounts, ALGORAND_CHAIN_ID)).toBeNull()
    })

    it('account-in-hand forms resolve without the account being stored', () => {
        const outsider = watch('Z', 'A')
        expect(canSignWith(outsider, accounts, ALGORAND_CHAIN_ID)).toBe(true)
        expect(
            resolveAuthAccount(outsider, accounts, ALGORAND_CHAIN_ID).address,
        ).toBe('A')
    })
})

describe('auth-account forms on a legacy multisig record without multisigDetails', () => {
    const legacy = {
        custody: { kind: 'multisig' },
        address: 'MS',
    } as WalletAccount

    it('resolve the auth hop without evaluating participants', () => {
        expect(resolveAuthAccount(legacy, [legacy], ALGORAND_CHAIN_ID)).toBe(
            legacy,
        )
        expect(getAuthAccount(legacy, [legacy], ALGORAND_CHAIN_ID)).toBe(legacy)
    })

    it('follow a rekey to a legacy multisig auth', () => {
        const account = watch('A', 'MS')
        expect(
            resolveAuthAccount(account, [account, legacy], ALGORAND_CHAIN_ID),
        ).toBe(legacy)
        expect(getRekeyAccount('A', [account, legacy], ALGORAND_CHAIN_ID)).toBe(
            legacy,
        )
    })
})

describe('resolveAuthAccount error payload', () => {
    it('names the missing rekey target', () => {
        const account = watch('A', 'GONE')
        expect(() =>
            resolveAuthAccount(account, [account], ALGORAND_CHAIN_ID),
        ).toThrow('Rekey target account GONE not found in local accounts')
    })
})
