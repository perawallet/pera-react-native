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

import { describe, test, expect } from 'vitest'
import {
    canSignArbitraryData,
    canSignArc60,
    canSignProgram,
    canSignViaParticipants,
    canSignWith,
    findAccountByKey,
    getAccountDisplayName,
    getRekeyAccount,
    getSignerFor,
    hasSigningKeys,
    isAlgo25Account,
    isEligibleLedgerRekeyTarget,
    isEligibleRekeyTarget,
    isEligibleSharedRekeyTarget,
    isQuantumAccount,
    isQuantumDowngrade,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
    matchesAccountKey,
    rekeyTransitionFor,
    resolveAuthAccount,
    resolveImportAccountType,
} from '../utils'
import { AccountTypes, type WalletAccount } from '../models'
import { MNEMONIC_WORD_COUNT } from '../constants'
import { RekeyTargetNotFoundError } from '../errors'

vi.mock('tweetnacl', () => ({
    default: {
        sign: {
            keyPair: {
                fromSeed: vi.fn(() => ({
                    publicKey: new Uint8Array(32).fill(3),
                })),
            },
        },
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: vi.fn(() => 'TEST_ADDRESS'),
}))

describe('services/accounts/utils - canSignViaParticipants', () => {
    const signable = {
        address: 'P1',
        type: AccountTypes.algo25,
        keyPairId: 'kp',
    } as WalletAccount
    const watch = { address: 'P2', type: AccountTypes.watch } as WalletAccount
    const hardware = {
        address: 'P3',
        type: AccountTypes.hardware,
    } as WalletAccount

    test('true when a held participant can sign with its own key', () => {
        expect(canSignViaParticipants(['P1', 'P2'], [signable, watch])).toBe(
            true,
        )
    })

    test('true when a held participant is a hardware wallet', () => {
        expect(canSignViaParticipants(['P3'], [hardware])).toBe(true)
    })

    test('false when the only held participant is watch-only', () => {
        expect(canSignViaParticipants(['P2'], [watch])).toBe(false)
    })

    test('false when no participant address is held in the wallet', () => {
        expect(canSignViaParticipants(['P1'], [])).toBe(false)
    })
})

describe('services/accounts/utils - getAccountDisplayName', () => {
    test('returns account name when present', () => {
        const acc = {
            id: '1',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'Named',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('Named')
    })

    test('returns "No Address Found" when address is missing or empty', () => {
        const acc = {
            id: '2',
            type: 'hdWallet',
            address: '',
            canSign: false,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('No Address Found')
    })

    test('returns address unchanged when length <= 11', () => {
        const acc1 = {
            id: '3',
            type: 'hdWallet',
            address: 'SHORT',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc1)).toEqual('SHORT')

        const acc2 = {
            id: '4',
            type: 'hdWallet',
            address: 'ABCDEFGHIJK',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc2)).toEqual('ABCDEFGHIJK')
    })

    test('truncates long addresses to 5 prefix and suffix characters', () => {
        const acc1 = {
            id: '5',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKL',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc1)).toEqual('ABCDE...HIJKL')

        const acc2 = {
            id: '6',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc2)).toEqual('ABCDE...VWXYZ')
    })

    test('falls back to the truncated address when the name is the full address', () => {
        const acc = {
            id: '7',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDE...VWXYZ')
    })

    test('falls back to the truncated address when the name is the truncated address', () => {
        const acc = {
            id: '8',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDE...VWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDE...VWXYZ')
    })

    test('falls back to the truncated address when the name is a legacy-app truncation of the address', () => {
        // Legacy native apps auto-named accounts with a 6+6 truncation that
        // migration carries over verbatim.
        const acc = {
            id: '9',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDEF...UVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDE...VWXYZ')
    })

    test('falls back to the truncated address when the name truncates the address with a unicode ellipsis', () => {
        const acc = {
            id: '10',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDEF…UVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDE...VWXYZ')
    })

    test('keeps a custom name that only looks like a truncation but does not match the address', () => {
        const acc = {
            id: '11',
            type: 'hdWallet',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDEF...WRONG',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDEF...WRONG')
    })

    test('returns "No Account" when account is null', () => {
        expect(getAccountDisplayName(null)).toEqual('No Account')
    })
})

describe('services/accounts/utils - account type checks', () => {
    const baseAccount = {
        id: '1',
        type: 'hdWallet',
        address: 'ADDR1',
        keyPairId: 'pk1',
    } as any

    test('isHDWalletAccount returns true if type is hdWallet', () => {
        expect(isHDWalletAccount(baseAccount)).toBe(true)
        expect(
            isHDWalletAccount({
                ...baseAccount,
                type: 'algo25',
            } as any),
        ).toBe(false)
    })

    test('isLedgerAccount returns true if type is hardware and manufacturer is ledger', () => {
        expect(isLedgerAccount(baseAccount)).toBe(false)
        expect(
            isLedgerAccount({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: 'test-device',
                    deviceName: 'Ledger Nano X',
                    accountIndex: 0,
                    transportType: 'ble',
                },
            } as any),
        ).toBe(true)
        expect(
            isLedgerAccount({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: { manufacturer: 'other' as any },
            } as any),
        ).toBe(false)
    })

    test('isRekeyedAccount returns true if rekeyAddress is present', () => {
        expect(isRekeyedAccount(baseAccount)).toBe(false)
        expect(
            isRekeyedAccount({
                ...baseAccount,
                rekeyAddress: 'ADDR2',
            } as any),
        ).toBe(true)
    })

    test('isAlgo25Account returns true if type is algo25', () => {
        expect(isAlgo25Account(baseAccount)).toBe(false)
        expect(
            isAlgo25Account({
                ...baseAccount,
                type: 'algo25',
            } as any),
        ).toBe(true)
        expect(
            isAlgo25Account({
                ...baseAccount,
                type: 'hdWallet',
            } as any),
        ).toBe(false)
        expect(
            isAlgo25Account({
                ...baseAccount,
                type: 'watch',
            } as any),
        ).toBe(false)
    })

    test('isWatchAccount returns true if type is watch', () => {
        expect(isWatchAccount(baseAccount)).toBe(false)
        expect(
            isWatchAccount({
                ...baseAccount,
                type: 'watch',
            } as any),
        ).toBe(true)
    })

    test('isMultisigAccount returns true if type is multisig', () => {
        expect(isMultisigAccount(baseAccount)).toBe(false)
        expect(
            isMultisigAccount({
                ...baseAccount,
                type: 'multisig',
            } as any),
        ).toBe(true)
    })

    test('hasSigningKeys checks keyPairId', () => {
        expect(hasSigningKeys(baseAccount)).toBe(true)
        expect(
            hasSigningKeys({
                ...baseAccount,
                keyPairId: undefined,
            } as any),
        ).toBe(false)
    })

    test('canSignWith returns true for account with keyPairId', () => {
        expect(canSignWith(baseAccount, [])).toBe(true)
    })

    test('canSignWith returns false for account without keyPairId', () => {
        expect(
            canSignWith({ ...baseAccount, keyPairId: undefined } as any, []),
        ).toBe(false)
    })

    test('canSignWith returns true for rekeyed account when auth account has keys', () => {
        const authAccount = {
            id: '2',
            type: 'algo25',
            address: 'AUTH_ADDR',
            keyPairId: 'pk2',
        } as any

        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as any

        expect(canSignWith(rekeyedAccount, [authAccount])).toBe(true)
    })

    test('canSignWith returns false for rekeyed account when auth account has no keys', () => {
        const authAccount = {
            id: '2',
            type: 'watch',
            address: 'AUTH_ADDR',
        } as any

        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as any

        expect(canSignWith(rekeyedAccount, [authAccount])).toBe(false)
    })

    test('canSignWith returns false for rekeyed account when auth account is not in list', () => {
        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as any

        expect(canSignWith(rekeyedAccount, [])).toBe(false)
    })

    test('canSignWith resolves a single rekey hop only, not a chain', () => {
        const rootAccount = {
            id: '1',
            type: 'algo25',
            address: 'ROOT_ADDR',
            keyPairId: 'pk1',
        } as any

        const middleAccount = {
            id: '2',
            type: 'watch',
            address: 'MIDDLE_ADDR',
            rekeyAddress: 'ROOT_ADDR',
        } as any

        const leafAccount = {
            id: '3',
            type: 'watch',
            address: 'LEAF_ADDR',
            rekeyAddress: 'MIDDLE_ADDR',
        } as any

        const accounts = [rootAccount, middleAccount, leafAccount]
        // LEAF -> MIDDLE -> ROOT. MIDDLE holds no key, so LEAF cannot sign —
        // the hop from MIDDLE to ROOT is not followed.
        expect(canSignWith(leafAccount, accounts)).toBe(false)
        // MIDDLE -> ROOT, and ROOT holds a key, so MIDDLE can sign (one hop).
        expect(canSignWith(middleAccount, accounts)).toBe(true)
    })

    test('canSignWith does not recurse on a cyclic auth chain', () => {
        const a = {
            id: '1',
            type: 'watch',
            address: 'A',
            rekeyAddress: 'B',
        } as any
        const b = {
            id: '2',
            type: 'watch',
            address: 'B',
            rekeyAddress: 'A',
        } as any

        // Single-hop: A's immediate auth B holds no key — false, no infinite
        // recursion.
        expect(canSignWith(a, [a, b])).toBe(false)
    })
})

describe('services/accounts/utils - canSignWith (hardware + multisig)', () => {
    test('returns true for a non-rekeyed hardware account (no keyPairId)', () => {
        const account = {
            type: 'hardware',
            address: 'HW',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'test-device',
                deviceName: 'Ledger Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as any
        expect(canSignWith(account, [account])).toBe(true)
    })

    test('returns true for rekeyed account whose auth is a hardware account', () => {
        const authAccount = {
            type: 'hardware',
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
            type: 'watch',
            address: 'ADDR',
            rekeyAddress: 'AUTH',
        } as any
        expect(canSignWith(account, [account, authAccount])).toBe(true)
    })

    test('returns true for a multisig with a local signable participant', () => {
        const participant = {
            type: 'algo25',
            address: 'P1',
            keyPairId: 'pk1',
        } as any
        const multisig = {
            type: 'multisig',
            address: 'MS',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
        } as any
        expect(canSignWith(multisig, [multisig, participant])).toBe(true)
    })

    test('returns false for a multisig with no local signable participants', () => {
        const multisig = {
            type: 'multisig',
            address: 'MS',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
        } as any
        expect(canSignWith(multisig, [multisig])).toBe(false)
    })
})

describe('services/accounts/utils - canSignArbitraryData vs canSignArc60', () => {
    const localKey = {
        type: 'hdWallet',
        address: 'HD',
        keyPairId: 'pk1',
    } as any
    const hardware = {
        type: 'hardware',
        address: 'HW',
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'dev',
            deviceName: 'Ledger Nano X',
            accountIndex: 0,
            transportType: 'ble',
        },
    } as any
    const watch = { type: 'watch', address: 'WATCH' } as any
    const multisig = {
        type: 'multisig',
        address: 'MS',
        multisigDetails: { threshold: 2, addresses: ['P1', 'P2'] },
    } as any

    test('canSignArbitraryData is local-key only (excludes hardware)', () => {
        expect(canSignArbitraryData(localKey)).toBe(true)
        expect(canSignArbitraryData(hardware)).toBe(false)
        expect(canSignArbitraryData(watch)).toBe(false)
        expect(canSignArbitraryData(multisig)).toBe(false)
    })

    test('canSignArc60 also accepts hardware (on-device path)', () => {
        expect(canSignArc60(localKey, [localKey])).toBe(true)
        expect(canSignArc60(hardware, [hardware])).toBe(true)
        expect(canSignArc60(watch, [watch])).toBe(false)
        expect(canSignArc60(multisig, [multisig])).toBe(false)
    })

    describe('canSignArc60 - rekeyed signers', () => {
        const rekeyedTo = (auth: { address: string }) =>
            ({ ...watch, rekeyAddress: auth.address }) as any

        test('accepts a keyless rekeyed account whose auth holds local keys', () => {
            const rekeyed = rekeyedTo(localKey)
            expect(canSignArc60(rekeyed, [rekeyed, localKey])).toBe(true)
        })

        test('accepts a keyless rekeyed account whose auth is a hardware wallet', () => {
            const rekeyed = rekeyedTo(hardware)
            expect(canSignArc60(rekeyed, [rekeyed, hardware])).toBe(true)
        })

        test('rejects when the auth account is not in the wallet', () => {
            const rekeyed = rekeyedTo({ address: 'ABSENT' })
            expect(canSignArc60(rekeyed, [rekeyed])).toBe(false)
        })

        test('rejects when the auth account is itself watch-only', () => {
            const rekeyed = rekeyedTo(watch)
            expect(canSignArc60(rekeyed, [rekeyed, watch])).toBe(false)
        })

        // ARC-60 carries a single signature, so a threshold account can never
        // be represented — createMultisigStrategy refuses it downstream.
        test('rejects when the auth account is a multisig', () => {
            const rekeyed = rekeyedTo(multisig)
            expect(canSignArc60(rekeyed, [rekeyed, multisig])).toBe(false)
        })

        // ARC-60 verifies Ed25519 only, so a Falcon signature from a quantum
        // auth would be a guaranteed dApp-side failure — the same reason
        // canSignViaParticipants excludes quantum from multisig slots.
        test('rejects when the auth account is quantum', () => {
            const quantumAuth = {
                type: 'quantum',
                address: 'Q',
                keyPairId: 'pkq',
            } as any
            const rekeyed = rekeyedTo(quantumAuth)
            expect(canSignArc60(rekeyed, [rekeyed, quantumAuth])).toBe(false)
        })

        // The hop is a fallback, not an override. A dApp that resolved the
        // auth address itself names THAT account as the signer, so hopping
        // again off its own chained rekey would sign with a key the
        // authenticated account's auth-addr never designated.
        test('does not hop when the rekeyed signer holds its own key', () => {
            const chained = { ...localKey, rekeyAddress: watch.address } as any
            expect(canSignArc60(chained, [chained, watch])).toBe(true)
        })
    })

    test('canSignProgram excludes hardware, which has no program-signing path', () => {
        expect(canSignProgram(localKey)).toBe(true)
        expect(canSignProgram(hardware)).toBe(false)
        expect(canSignProgram(watch)).toBe(false)
        expect(canSignProgram(multisig)).toBe(false)
    })

    // Guards the reason canSignProgram checks the account type rather than
    // relying on hardware and multisig accounts happening to carry no
    // keyPairId: the field is optional on the base type, so nothing stops one
    // appearing. A delegated LSig carries a single sigkey, so multisig can
    // never be represented regardless of what keys it holds.
    test('canSignProgram stays false for hardware and multisig even with a keyPairId', () => {
        expect(canSignProgram({ ...hardware, keyPairId: 'pk1' })).toBe(false)
        expect(
            canSignArc60({ ...hardware, keyPairId: 'pk1' }, [hardware]),
        ).toBe(true)
        expect(canSignProgram({ ...multisig, keyPairId: 'pk1' })).toBe(false)
    })

    // A delegated LSig is checked against the sender's auth-addr, so only the
    // auth account could usefully sign it. Refused until the signer resolves
    // that; canSignArbitraryData ignores rekeys (no auth-addr off-chain).
    test('canSignProgram excludes rekeyed accounts, unlike canSignArbitraryData', () => {
        const rekeyed = { ...localKey, rekeyAddress: 'AUTH' }
        expect(canSignProgram(rekeyed)).toBe(false)
        expect(canSignArbitraryData(rekeyed)).toBe(true)
    })
})

describe('services/accounts/utils - getRekeyAccount', () => {
    test('returns the auth account when rekeyed and target is in the wallet', () => {
        const auth = {
            type: 'algo25',
            address: 'AUTH',
            keyPairId: 'pk1',
        } as any
        const rekeyed = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'pk2',
            rekeyAddress: 'AUTH',
        } as any
        expect(getRekeyAccount('A', [rekeyed, auth])).toBe(auth)
    })

    test('returns null when the address is not rekeyed', () => {
        const account = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'pk1',
        } as any
        expect(getRekeyAccount('A', [account])).toBeNull()
    })

    test('returns null when the rekey target is not in the wallet', () => {
        const rekeyed = {
            type: 'watch',
            address: 'A',
            rekeyAddress: 'MISSING',
        } as any
        expect(getRekeyAccount('A', [rekeyed])).toBeNull()
    })

    test('returns null when the address is unknown', () => {
        expect(getRekeyAccount('UNKNOWN', [])).toBeNull()
    })
})

describe('services/accounts/utils - getSignerFor', () => {
    test('returns the account itself when it holds its own key', () => {
        const account = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'pk1',
        } as any
        expect(getSignerFor('A', [account])).toBe(account)
    })

    test('returns the immediate auth account when rekeyed and we can sign', () => {
        const auth = {
            type: 'algo25',
            address: 'AUTH',
            keyPairId: 'pk1',
        } as any
        const rekeyed = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'pk2',
            rekeyAddress: 'AUTH',
        } as any
        expect(getSignerFor('A', [rekeyed, auth])).toBe(auth)
    })

    test('returns null for an unsignable rekeyed account', () => {
        const rekeyed = {
            type: 'watch',
            address: 'A',
            rekeyAddress: 'MISSING',
        } as any
        expect(getSignerFor('A', [rekeyed])).toBeNull()
    })

    test('returns null for a non-rekeyed watch account', () => {
        const account = { type: 'watch', address: 'A' } as any
        expect(getSignerFor('A', [account])).toBeNull()
    })

    test('returns the multisig itself when at least one participant is local and signable', () => {
        const participant = {
            type: 'algo25',
            address: 'P1',
            keyPairId: 'pk1',
        } as any
        const multisig = {
            type: 'multisig',
            address: 'MS',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2'],
                version: 1,
            },
        } as any
        expect(getSignerFor('MS', [multisig, participant])).toBe(multisig)
    })

    test('returns null when address is not in the wallet', () => {
        expect(getSignerFor('UNKNOWN', [])).toBeNull()
    })
})

describe('services/accounts/utils - rekeyTransitionFor', () => {
    test('returns null for a non-rekeyed account', () => {
        const account = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'pk1',
        } as any
        expect(rekeyTransitionFor(account, [account])).toBeNull()
    })

    test('returns null for a rekeyed account whose auth is not in the wallet', () => {
        const rekeyed = {
            type: 'algo25',
            address: 'A',
            keyPairId: 'pk1',
            rekeyAddress: 'MISSING',
        } as any
        expect(rekeyTransitionFor(rekeyed, [rekeyed])).toBeNull()
    })

    test('returns from/to raw types for a signable rekey', () => {
        const auth = {
            type: 'hardware',
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
            type: 'algo25',
            address: 'A',
            keyPairId: 'pk1',
            rekeyAddress: 'AUTH',
        } as any
        expect(rekeyTransitionFor(rekeyed, [rekeyed, auth])).toEqual({
            from: 'algo25',
            to: 'hardware',
        })
    })
})

describe('services/accounts/utils - resolveImportAccountType', () => {
    const words = (count: number) =>
        Array.from({ length: count }, (_, i) => `word${i}`).join(' ')

    test('quantum mnemonics are 25 words', () => {
        expect(MNEMONIC_WORD_COUNT.quantum).toBe(25)
    })

    test('returns hdWallet for 24-word mnemonic', () => {
        const result = resolveImportAccountType(words(24))
        expect(result).toEqual({ success: true, accountType: 'hdWallet' })
    })

    test('25-word mnemonic still auto-resolves to algo25, never quantum', () => {
        // Product decision: a 25-word quantum mnemonic is indistinguishable
        // from legacy algo25 by word count. Auto-detection deliberately keeps
        // resolving 25 words to algo25; quantum import only happens through
        // its dedicated explicit entrypoint.
        const result = resolveImportAccountType(words(25))
        expect(result).toEqual({ success: true, accountType: 'algo25' })
    })

    test('returns failure for 23-word mnemonic', () => {
        const result = resolveImportAccountType(words(23))
        expect(result).toEqual({ success: false, wordCount: 23 })
    })

    test('returns failure for 26-word mnemonic', () => {
        const result = resolveImportAccountType(words(26))
        expect(result).toEqual({ success: false, wordCount: 26 })
    })

    test('returns failure for single word', () => {
        const result = resolveImportAccountType('single')
        expect(result).toEqual({ success: false, wordCount: 1 })
    })

    test('handles leading and trailing whitespace', () => {
        const result = resolveImportAccountType(`  ${words(25)}  `)
        expect(result).toEqual({ success: true, accountType: 'algo25' })
    })

    test('handles extra whitespace between words', () => {
        const mnemonic = Array.from({ length: 24 }, (_, i) => `word${i}`).join(
            '   ',
        )
        const result = resolveImportAccountType(mnemonic)
        expect(result).toEqual({ success: true, accountType: 'hdWallet' })
    })
})

describe('matchesAccountKey / findAccountByKey', () => {
    const a = { id: '1', address: 'ALICE' }
    const b = { id: '2', address: 'BOB' }
    const accounts = [a, b]

    test('matches by address when address is supplied', () => {
        expect(findAccountByKey(accounts, { address: 'ALICE' })).toBe(a)
    })

    test('falls back to id when address is missing', () => {
        expect(findAccountByKey(accounts, { id: '2' })).toBe(b)
    })

    test('matches when either address or id matches (OR semantics)', () => {
        expect(findAccountByKey(accounts, { address: 'ALICE', id: '99' })).toBe(
            a,
        )
        expect(findAccountByKey(accounts, { address: 'NOPE', id: '2' })).toBe(b)
    })

    test('returns undefined when nothing matches', () => {
        expect(
            findAccountByKey(accounts, { address: 'NOPE', id: '99' }),
        ).toBeUndefined()
    })

    test('empty key matches nothing', () => {
        expect(findAccountByKey(accounts, {})).toBeUndefined()
        expect(matchesAccountKey({})(a)).toBe(false)
    })

    test('empty-string fields are treated as missing', () => {
        expect(matchesAccountKey({ address: '', id: '' })(a)).toBe(false)
    })
})

const algo25 = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'a',
        address: overrides.address ?? 'A',
        type: AccountTypes.algo25,
        keyPairId: 'kp',
        ...overrides,
    }) as WalletAccount

const hd = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'h',
        address: overrides.address ?? 'H',
        type: AccountTypes.hdWallet,
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
        type: AccountTypes.hardware,
        hardwareDetails: { deviceId: 'dev', addressIndex: 0 },
        ...overrides,
    }) as WalletAccount

const watch = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'w',
        address: overrides.address ?? 'W',
        type: AccountTypes.watch,
        ...overrides,
    }) as WalletAccount

const multisig = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'm',
        address: overrides.address ?? 'M',
        type: AccountTypes.multisig,
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
        type: AccountTypes.quantum,
        keyPairId: 'kp-quantum',
        ...overrides,
    }) as WalletAccount

describe('services/accounts/utils - quantum accounts', () => {
    test('isQuantumAccount returns true only for quantum accounts', () => {
        expect(isQuantumAccount(quantum())).toBe(true)
        expect(isQuantumAccount(algo25())).toBe(false)
        expect(isQuantumAccount(hd())).toBe(false)
        expect(isQuantumAccount(ledger())).toBe(false)
        expect(isQuantumAccount(watch())).toBe(false)
        expect(isQuantumAccount(multisig())).toBe(false)
    })

    test('other type guards reject quantum accounts', () => {
        expect(isAlgo25Account(quantum())).toBe(false)
        expect(isHDWalletAccount(quantum())).toBe(false)
        expect(isWatchAccount(quantum())).toBe(false)
        expect(isMultisigAccount(quantum())).toBe(false)
    })

    test('hasSigningKeys is true for a keyPairId-backed quantum account', () => {
        expect(hasSigningKeys(quantum())).toBe(true)
    })

    test('canSignArbitraryData and canSignArc60 are true for quantum', () => {
        expect(canSignArbitraryData(quantum())).toBe(true)
        expect(canSignArc60(quantum(), [quantum()])).toBe(true)
    })

    test('canSignWith resolves a quantum account as its own signer', () => {
        const account = quantum()
        expect(canSignWith(account, [account])).toBe(true)
    })

    test('canSignWith resolves a quantum auth account for a rekeyed account', () => {
        const auth = quantum({ address: 'FAUTH' })
        const rekeyed = watch({ address: 'A', rekeyAddress: 'FAUTH' })
        expect(canSignWith(rekeyed, [rekeyed, auth])).toBe(true)
    })

    test('quantum keys are not valid multisig participants (Ed25519-only protocol)', () => {
        expect(canSignViaParticipants(['F'], [quantum({ address: 'F' })])).toBe(
            false,
        )
    })
})

describe('services/accounts/utils - isEligibleRekeyTarget', () => {
    const src = { address: 'SRC' }

    test('rejects target equal to source', () => {
        expect(
            isEligibleRekeyTarget(
                algo25({ address: 'A' }),
                { address: 'A' },
                true,
            ),
        ).toBe(false)
    })

    test("rejects target equal to source's current auth", () => {
        expect(
            isEligibleRekeyTarget(
                algo25({ address: 'B' }),
                { address: 'SRC', rekeyAddress: 'B' },
                true,
            ),
        ).toBe(false)
    })

    test('rejects multisig / hardware / watch targets', () => {
        expect(
            isEligibleRekeyTarget(multisig({ address: 'M' }), src, true),
        ).toBe(false)
        expect(isEligibleRekeyTarget(ledger({ address: 'L' }), src, true)).toBe(
            false,
        )
        expect(isEligibleRekeyTarget(watch({ address: 'W' }), src, true)).toBe(
            false,
        )
    })

    test('rejects target without signing keys', () => {
        const noKey = algo25({ address: 'A' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(noKey as any).keyPairId = undefined
        expect(isEligibleRekeyTarget(noKey, src, true)).toBe(false)
    })

    test('rejects target already rekeyed away', () => {
        expect(
            isEligibleRekeyTarget(
                algo25({ address: 'A', rekeyAddress: 'B' }),
                src,
                true,
            ),
        ).toBe(false)
    })

    test('accepts valid algo25 / hdWallet target', () => {
        expect(isEligibleRekeyTarget(algo25({ address: 'A' }), src, true)).toBe(
            true,
        )
        expect(isEligibleRekeyTarget(hd({ address: 'H' }), src, true)).toBe(
            true,
        )
    })

    test('accepts a rekeyed source rekeying to a different fresh target', () => {
        expect(
            isEligibleRekeyTarget(
                algo25({ address: 'A' }),
                { address: 'SRC', rekeyAddress: 'B' },
                true,
            ),
        ).toBe(true)
    })

    test('accepts a quantum target when quantum targets are enabled (rekey-in migration path)', () => {
        expect(
            isEligibleRekeyTarget(quantum({ address: 'F' }), src, true),
        ).toBe(true)
    })

    test('rejects a quantum target when quantum targets are disabled', () => {
        expect(
            isEligibleRekeyTarget(quantum({ address: 'F' }), src, false),
        ).toBe(false)
    })

    test('the quantum gate does not affect non-quantum targets', () => {
        expect(
            isEligibleRekeyTarget(algo25({ address: 'A' }), src, false),
        ).toBe(true)
    })

    test('rejects a quantum target already rekeyed away', () => {
        expect(
            isEligibleRekeyTarget(
                quantum({ address: 'F', rekeyAddress: 'X' }),
                src,
                true,
            ),
        ).toBe(false)
    })
})

describe('services/accounts/utils - isQuantumDowngrade', () => {
    test('quantum source to a plain Ed25519 target is a downgrade', () => {
        const source = quantum({ address: 'F' })
        const target = algo25({ address: 'A' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(true)
        expect(
            isQuantumDowngrade(source, hd({ address: 'H' }), [
                source,
                hd({ address: 'H' }),
            ]),
        ).toBe(true)
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
        const target = watch({ address: 'T', rekeyAddress: 'FAUTH' })
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
        const source = algo25({ address: 'A', rekeyAddress: 'FAUTH' })
        const target = algo25({ address: 'B' })
        expect(
            isQuantumDowngrade(source, target, [source, target, quantumAuth]),
        ).toBe(true)
    })

    test('quantum-typed source already rekeyed to an Ed25519 auth is not a downgrade', () => {
        // Its effective signer is already Ed25519 — there is no quantum
        // protection left to remove, so the warning would be untrue.
        const ed25519Auth = algo25({ address: 'EAUTH' })
        const source = quantum({ address: 'F', rekeyAddress: 'EAUTH' })
        const target = algo25({ address: 'B' })
        expect(
            isQuantumDowngrade(source, target, [source, target, ed25519Auth]),
        ).toBe(false)
    })

    test('source whose auth is not held locally (broken chain) is not a downgrade', () => {
        // resolveAuthAccount throws when the auth is unheld; we cannot assert
        // quantum protection we cannot resolve.
        const source = quantum({ address: 'F', rekeyAddress: 'MISSING' })
        const target = algo25({ address: 'B' })
        expect(isQuantumDowngrade(source, target, [source, target])).toBe(false)
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
        expect(
            isEligibleLedgerRekeyTarget(
                ledger({ address: 'L', rekeyAddress: 'X' }),
                src,
            ),
        ).toBe(false)
    })

    test("rejects target equal to source's current auth", () => {
        expect(
            isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), {
                address: 'SRC',
                rekeyAddress: 'L',
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
        expect(
            isEligibleSharedRekeyTarget(
                ms,
                { address: 'SRC', rekeyAddress: 'M' },
                all,
            ),
        ).toBe(false)
    })

    test('rejects multisig already rekeyed away', () => {
        const ms = multisig({
            address: 'M',
            rekeyAddress: 'X',
            multisigDetails: {
                threshold: 1,
                addresses: ['P1'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [algo25({ id: 'p1', address: 'P1' })]
        expect(isEligibleSharedRekeyTarget(ms, src, all)).toBe(false)
    })
})

describe('services/accounts/utils - resolveAuthAccount', () => {
    test('returns the account itself when not rekeyed', () => {
        const a = algo25({ address: 'A' })
        expect(resolveAuthAccount(a, [a])).toBe(a)
    })

    test('walks a single rekey hop', () => {
        const a = algo25({ address: 'A', rekeyAddress: 'B' })
        const b = algo25({ address: 'B' })
        expect(resolveAuthAccount(a, [a, b])).toBe(b)
    })

    test('resolves a single hop only — not the terminal of the chain', () => {
        // A -> B -> C. B signs for A; rekey indirection is not transitive.
        const a = ledger({ address: 'A', rekeyAddress: 'B' })
        const b = ledger({ address: 'B', rekeyAddress: 'C' })
        const c = ledger({ address: 'C' })
        expect(resolveAuthAccount(a, [a, b, c])).toBe(b)
    })

    test('throws RekeyTargetNotFoundError when the auth account is not held', () => {
        const a = algo25({ address: 'A', rekeyAddress: 'MISSING' })
        expect(() => resolveAuthAccount(a, [a])).toThrow(
            RekeyTargetNotFoundError,
        )
    })
})
