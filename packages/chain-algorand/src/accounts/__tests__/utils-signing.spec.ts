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
    getRekeyAccount,
    getSignerFor,
    isQuantumDowngrade,
    delegateTransitionFor,
    resolveAuthAccount,
    useAccountChainStateStore,
    DelegationTargetNotFoundError,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
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

type BuilderOverrides = Partial<WalletAccount> & { authority?: string }

const withAuthority = (
    account: WalletAccount,
    authority?: string,
): WalletAccount => {
    if (authority) seedAuthority(account.address as string, authority)
    return account
}

const algo25 = ({
    authority,
    ...overrides
}: BuilderOverrides = {}): WalletAccount =>
    withAuthority(
        {
            id: overrides.id ?? 'a',
            address: overrides.address ?? 'A',
            custody: { kind: 'local', seed: 'algo25' },
            keyPairId: 'kp',
            ...overrides,
        } as WalletAccount,
        authority,
    )

const hd = ({
    authority,
    ...overrides
}: BuilderOverrides = {}): WalletAccount =>
    withAuthority(
        {
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
        } as WalletAccount,
        authority,
    )

const ledger = ({
    authority,
    ...overrides
}: BuilderOverrides = {}): WalletAccount =>
    withAuthority(
        {
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
        } as WalletAccount,
        authority,
    )

const watch = ({
    authority,
    ...overrides
}: BuilderOverrides = {}): WalletAccount =>
    withAuthority(
        {
            id: overrides.id ?? 'w',
            address: overrides.address ?? 'W',
            custody: { kind: 'watch' },
            ...overrides,
        } as WalletAccount,
        authority,
    )

const multisig = ({
    authority,
    ...overrides
}: BuilderOverrides = {}): WalletAccount =>
    withAuthority(
        {
            id: overrides.id ?? 'm',
            address: overrides.address ?? 'M',
            custody: { kind: 'multisig' },
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
            ...overrides,
        } as WalletAccount,
        authority,
    )

const quantum = ({
    authority,
    ...overrides
}: BuilderOverrides = {}): WalletAccount =>
    withAuthority(
        {
            id: overrides.id ?? 'f',
            address: overrides.address ?? 'F',
            custody: { kind: 'local', seed: 'quantum' },
            keyPairId: 'kp-quantum',
            ...overrides,
        } as WalletAccount,
        authority,
    )

describe('services/accounts/utils - account type checks', () => {
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

    test('canSignWith returns true for account with keyPairId', () => {
        expect(canSignWith(baseAccount, [], ALGORAND_CHAIN_ID)).toBe(true)
    })

    test('canSignWith returns false for account without keyPairId', () => {
        expect(
            canSignWith(
                { ...baseAccount, keyPairId: undefined } as any,
                [],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    test('canSignWith returns true for rekeyed account when auth account has keys', () => {
        const authAccount = {
            id: '2',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'AUTH_ADDR',
            keyPairId: 'pk2',
        } as any

        const rekeyedAccount = {
            id: '3',
            custody: { kind: 'watch' },
            address: 'REKEYED_ADDR',
        } as any
        seedAuthority('REKEYED_ADDR', 'AUTH_ADDR')

        expect(
            canSignWith(rekeyedAccount, [authAccount], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    test('canSignWith returns false for rekeyed account when auth account has no keys', () => {
        const authAccount = {
            id: '2',
            custody: { kind: 'watch' },
            address: 'AUTH_ADDR',
        } as any

        const rekeyedAccount = {
            id: '3',
            custody: { kind: 'watch' },
            address: 'REKEYED_ADDR',
        } as any
        seedAuthority('REKEYED_ADDR', 'AUTH_ADDR')

        expect(
            canSignWith(rekeyedAccount, [authAccount], ALGORAND_CHAIN_ID),
        ).toBe(false)
    })

    test('canSignWith returns false for rekeyed account when auth account is not in list', () => {
        const rekeyedAccount = {
            id: '3',
            custody: { kind: 'watch' },
            address: 'REKEYED_ADDR',
        } as any
        seedAuthority('REKEYED_ADDR', 'AUTH_ADDR')

        expect(canSignWith(rekeyedAccount, [], ALGORAND_CHAIN_ID)).toBe(false)
    })

    test('canSignWith resolves a single rekey hop only, not a chain', () => {
        const rootAccount = {
            id: '1',
            custody: { kind: 'local', seed: 'algo25' },
            address: 'ROOT_ADDR',
            keyPairId: 'pk1',
        } as any

        const middleAccount = {
            id: '2',
            custody: { kind: 'watch' },
            address: 'MIDDLE_ADDR',
        } as any
        seedAuthority('MIDDLE_ADDR', 'ROOT_ADDR')

        const leafAccount = {
            id: '3',
            custody: { kind: 'watch' },
            address: 'LEAF_ADDR',
        } as any
        seedAuthority('LEAF_ADDR', 'MIDDLE_ADDR')

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
        const a = {
            id: '1',
            custody: { kind: 'watch' },
            address: 'A',
        } as any
        seedAuthority('A', 'B')
        const b = {
            id: '2',
            custody: { kind: 'watch' },
            address: 'B',
        } as any
        seedAuthority('B', 'A')

        // Single-hop: A's immediate auth B holds no key — false, no infinite
        // recursion.
        expect(canSignWith(a, [a, b], ALGORAND_CHAIN_ID)).toBe(false)
    })
})

describe('services/accounts/utils - canSignWith (hardware + multisig)', () => {
    test('returns true for a non-rekeyed hardware account (no keyPairId)', () => {
        const account = {
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'test-device',
                    deviceName: 'Ledger Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
            address: 'HW',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'test-device',
                deviceName: 'Ledger Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as any
        expect(canSignWith(account, [account], ALGORAND_CHAIN_ID)).toBe(true)
    })

    test('returns true for rekeyed account whose auth is a hardware account', () => {
        const authAccount = {
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'test-device',
                    deviceName: 'Ledger Nano X',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
            address: 'AUTH',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'test-device',
                deviceName: 'Ledger Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as any
        const account = {
            custody: { kind: 'watch' },
            address: 'ADDR',
        } as any
        seedAuthority('ADDR', 'AUTH')
        expect(
            canSignWith(account, [account, authAccount], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    test('returns true for a multisig with a local signable participant', () => {
        const participant = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'P1',
            keyPairId: 'pk1',
        } as any
        const multisig = {
            custody: { kind: 'multisig' },
            address: 'MS',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
        } as any
        expect(
            canSignWith(multisig, [multisig, participant], ALGORAND_CHAIN_ID),
        ).toBe(true)
    })

    test('returns false for a multisig with no local signable participants', () => {
        const multisig = {
            custody: { kind: 'multisig' },
            address: 'MS',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
        } as any
        expect(canSignWith(multisig, [multisig], ALGORAND_CHAIN_ID)).toBe(false)
    })
})

describe('services/accounts/utils - getRekeyAccount', () => {
    test('returns the auth account when rekeyed and target is in the wallet', () => {
        const auth = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'AUTH',
            keyPairId: 'pk1',
        } as any
        const rekeyed = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'A',
            keyPairId: 'pk2',
        } as any
        seedAuthority('A', 'AUTH')
        expect(getRekeyAccount('A', [rekeyed, auth], ALGORAND_CHAIN_ID)).toBe(
            auth,
        )
    })

    test('returns null when the address is not rekeyed', () => {
        const account = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'A',
            keyPairId: 'pk1',
        } as any
        expect(getRekeyAccount('A', [account], ALGORAND_CHAIN_ID)).toBeNull()
    })

    test('returns null when the rekey target is not in the wallet', () => {
        const rekeyed = {
            custody: { kind: 'watch' },
            address: 'A',
        } as any
        seedAuthority('A', 'MISSING')
        expect(getRekeyAccount('A', [rekeyed], ALGORAND_CHAIN_ID)).toBeNull()
    })

    test('returns null when the address is unknown', () => {
        expect(getRekeyAccount('UNKNOWN', [], ALGORAND_CHAIN_ID)).toBeNull()
    })
})

describe('services/accounts/utils - getSignerFor', () => {
    test('returns the account itself when it holds its own key', () => {
        const account = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'A',
            keyPairId: 'pk1',
        } as any
        expect(getSignerFor('A', [account], ALGORAND_CHAIN_ID)).toBe(account)
    })

    test('returns the immediate auth account when rekeyed and we can sign', () => {
        const auth = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'AUTH',
            keyPairId: 'pk1',
        } as any
        const rekeyed = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'A',
            keyPairId: 'pk2',
        } as any
        seedAuthority('A', 'AUTH')
        expect(getSignerFor('A', [rekeyed, auth], ALGORAND_CHAIN_ID)).toBe(auth)
    })

    test('returns null for an unsignable rekeyed account', () => {
        const rekeyed = {
            custody: { kind: 'watch' },
            address: 'A',
        } as any
        seedAuthority('A', 'MISSING')
        expect(getSignerFor('A', [rekeyed], ALGORAND_CHAIN_ID)).toBeNull()
    })

    test('returns null for a non-rekeyed watch account', () => {
        const account = { custody: { kind: 'watch' }, address: 'A' } as any
        expect(getSignerFor('A', [account], ALGORAND_CHAIN_ID)).toBeNull()
    })

    test('returns the multisig itself when at least one participant is local and signable', () => {
        const participant = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'P1',
            keyPairId: 'pk1',
        } as any
        const multisig = {
            custody: { kind: 'multisig' },
            address: 'MS',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
        } as any
        expect(
            getSignerFor('MS', [multisig, participant], ALGORAND_CHAIN_ID),
        ).toBe(multisig)
    })

    test('returns null when address is not in the wallet', () => {
        expect(getSignerFor('UNKNOWN', [], ALGORAND_CHAIN_ID)).toBeNull()
    })
})

describe('services/accounts/utils - delegateTransitionFor', () => {
    test('returns null for a non-rekeyed account', () => {
        const account = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'A',
            keyPairId: 'pk1',
        } as any
        expect(
            delegateTransitionFor(account, [account], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    test('returns null for a rekeyed account whose auth is not in the wallet', () => {
        const rekeyed = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'A',
            keyPairId: 'pk1',
        } as any
        seedAuthority('A', 'MISSING')
        expect(
            delegateTransitionFor(rekeyed, [rekeyed], ALGORAND_CHAIN_ID),
        ).toBeNull()
    })

    test('returns from/to raw types for a signable rekey', () => {
        const auth = {
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: 'd',
                    deviceName: 'Ledger',
                    transportType: 'ble',
                },
                accountIndex: 0,
            },
            address: 'AUTH',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'd',
                deviceName: 'Ledger',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as any
        const rekeyed = {
            custody: { kind: 'local', seed: 'algo25' },
            address: 'A',
            keyPairId: 'pk1',
        } as any
        seedAuthority('A', 'AUTH')
        expect(
            delegateTransitionFor(rekeyed, [rekeyed, auth], ALGORAND_CHAIN_ID),
        ).toEqual({
            from: 'algo25',
            to: 'hardware',
        })
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

describe('services/accounts/utils - isQuantumDowngrade', () => {
    test('quantum source to a plain Ed25519 target is a downgrade', () => {
        const source = quantum({ address: 'F' })
        const target = algo25({ address: 'A' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(true)
        expect(
            isQuantumDowngrade(
                source,
                hd({ address: 'H' }),
                [source, hd({ address: 'H' })],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(true)
    })

    test('quantum source to a quantum target is not a downgrade', () => {
        const source = quantum({ address: 'F1' })
        const target = quantum({ address: 'F2' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    test('Ed25519 source to a quantum target is not a downgrade', () => {
        const source = algo25({ address: 'A' })
        const target = quantum({ address: 'F' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    test('Ed25519 source to an Ed25519 target is not a downgrade', () => {
        const source = algo25({ address: 'A' })
        const target = hd({ address: 'H' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    test('quantum source to a target whose effective auth is quantum is not a downgrade', () => {
        // Target is itself rekeyed to a quantum account, so its effective
        // signing authority resolves to quantum via resolveAuthAccount.
        const source = quantum({ address: 'F1' })
        const quantumAuth = quantum({ address: 'FAUTH' })
        const target = watch({ address: 'T', authority: 'FAUTH' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target, quantumAuth],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    test('quantum source to a hardware/ledger target is a downgrade', () => {
        const source = quantum({ address: 'F' })
        const target = ledger({ address: 'L' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(true)
    })

    test('Ed25519 source rekeyed to a quantum auth (rekey-in), rekeying to an Ed25519 target, is a downgrade', () => {
        // The flagship migration path: the account's own type stays algo25,
        // but its effective signer is quantum — rekeying to Ed25519 strips it.
        const quantumAuth = quantum({ address: 'FAUTH' })
        const source = algo25({ address: 'A', authority: 'FAUTH' })
        const target = algo25({ address: 'B' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target, quantumAuth],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(true)
    })

    test('quantum-typed source already rekeyed to an Ed25519 auth is not a downgrade', () => {
        // Its effective signer is already Ed25519 — there is no quantum
        // protection left to remove, so the warning would be untrue.
        const ed25519Auth = algo25({ address: 'EAUTH' })
        const source = quantum({ address: 'F', authority: 'EAUTH' })
        const target = algo25({ address: 'B' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target, ed25519Auth],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
    })

    test('source whose auth is not held locally (broken chain) is not a downgrade', () => {
        // resolveAuthAccount throws when the auth is unheld; we cannot assert
        // quantum protection we cannot resolve.
        const source = quantum({ address: 'F', authority: 'MISSING' })
        const target = algo25({ address: 'B' })
        expect(
            isQuantumDowngrade(
                source,
                target,
                [source, target],
                ALGORAND_CHAIN_ID,
            ),
        ).toBe(false)
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
