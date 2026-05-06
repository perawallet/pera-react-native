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

import { describe, test, expect } from 'vitest'
import {
    canSignWithAccount,
    getAccountDisplayName,
    hasSigningKeys,
    isAlgo25Account,
    isEligibleLedgerRekeyTarget,
    isEligibleRekeyTarget,
    isEligibleSharedRekeyTarget,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isSigningAccount,
    isRekeyedAccount,
    isWatchAccount,
    resolveAuthAccount,
    resolveImportAccountType,
} from '../utils'
import { AccountTypes, type WalletAccount } from '../models'
import { RekeyTargetNotFoundError } from '../errors'

vi.mock('bip39', () => ({
    mnemonicToSeed: vi.fn(async () => Buffer.from(new Uint8Array(64).fill(2))),
    mnemonicToEntropy: vi.fn(async () => 'test-entropy'),
}))

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

    test('canSignWithAccount returns true for account with keyPairId', () => {
        expect(canSignWithAccount(baseAccount, [])).toBe(true)
    })

    test('canSignWithAccount returns false for account without keyPairId', () => {
        expect(
            canSignWithAccount(
                { ...baseAccount, keyPairId: undefined } as any,
                [],
            ),
        ).toBe(false)
    })

    test('canSignWithAccount returns true for rekeyed account when auth account has keys', () => {
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

        expect(canSignWithAccount(rekeyedAccount, [authAccount])).toBe(true)
    })

    test('canSignWithAccount returns false for rekeyed account when auth account has no keys', () => {
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

        expect(canSignWithAccount(rekeyedAccount, [authAccount])).toBe(false)
    })

    test('canSignWithAccount returns false for rekeyed account when auth account is not in list', () => {
        const rekeyedAccount = {
            id: '3',
            type: 'watch',
            address: 'REKEYED_ADDR',
            rekeyAddress: 'AUTH_ADDR',
        } as any

        expect(canSignWithAccount(rekeyedAccount, [])).toBe(false)
    })

    test('canSignWithAccount handles rekey chain', () => {
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
        expect(canSignWithAccount(leafAccount, accounts)).toBe(true)
    })
})

describe('services/accounts/utils - isSigningAccount', () => {
    test('returns false for true watch account', () => {
        const account = { type: 'watch', address: 'ADDR' } as any
        expect(isSigningAccount(account, [])).toBe(false)
    })

    test('returns false for rekeyed account without auth in wallet (noAuth)', () => {
        const account = {
            type: 'watch',
            address: 'ADDR',
            rekeyAddress: 'MISSING_AUTH',
        } as any
        expect(isSigningAccount(account, [])).toBe(false)
    })

    test('returns true for rekeyed account with auth present (rekeyedStandard)', () => {
        const authAccount = {
            type: 'algo25',
            address: 'AUTH',
            keyPairId: 'pk1',
        } as any
        const account = {
            type: 'watch',
            address: 'ADDR',
            rekeyAddress: 'AUTH',
        } as any
        expect(isSigningAccount(account, [authAccount])).toBe(true)
    })

    test('returns true for rekeyed account with ledger auth present (rekeyedLedger)', () => {
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
        expect(isSigningAccount(account, [authAccount])).toBe(true)
    })

    test('returns true for standard account', () => {
        const account = {
            type: 'algo25',
            address: 'ADDR',
            keyPairId: 'pk1',
        } as any
        expect(isSigningAccount(account, [])).toBe(true)
    })
})

describe('services/accounts/utils - resolveImportAccountType', () => {
    const words = (count: number) =>
        Array.from({ length: count }, (_, i) => `word${i}`).join(' ')

    test('returns hdWallet for 24-word mnemonic', () => {
        const result = resolveImportAccountType(words(24))
        expect(result).toEqual({ success: true, accountType: 'hdWallet' })
    })

    test('returns algo25 for 25-word mnemonic', () => {
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

// Helpers for the rekey-flow predicates and the chain-walk resolver.
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

describe('services/accounts/utils - isEligibleRekeyTarget', () => {
    test('rejects target equal to source', () => {
        expect(isEligibleRekeyTarget(algo25({ address: 'A' }), 'A')).toBe(false)
    })

    test('rejects multisig / hardware / watch targets', () => {
        expect(isEligibleRekeyTarget(multisig({ address: 'M' }), 'SRC')).toBe(
            false,
        )
        expect(isEligibleRekeyTarget(ledger({ address: 'L' }), 'SRC')).toBe(
            false,
        )
        expect(isEligibleRekeyTarget(watch({ address: 'W' }), 'SRC')).toBe(
            false,
        )
    })

    test('rejects target without signing keys', () => {
        const noKey = algo25({ address: 'A' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(noKey as any).keyPairId = undefined
        expect(isEligibleRekeyTarget(noKey, 'SRC')).toBe(false)
    })

    test('rejects target already rekeyed away', () => {
        expect(
            isEligibleRekeyTarget(
                algo25({ address: 'A', rekeyAddress: 'B' }),
                'SRC',
            ),
        ).toBe(false)
    })

    test('accepts valid algo25 / hdWallet target', () => {
        expect(isEligibleRekeyTarget(algo25({ address: 'A' }), 'SRC')).toBe(
            true,
        )
        expect(isEligibleRekeyTarget(hd({ address: 'H' }), 'SRC')).toBe(true)
    })
})

describe('services/accounts/utils - isEligibleLedgerRekeyTarget', () => {
    test('rejects non-hardware targets', () => {
        expect(
            isEligibleLedgerRekeyTarget(algo25({ address: 'A' }), 'SRC'),
        ).toBe(false)
        expect(isEligibleLedgerRekeyTarget(hd({ address: 'H' }), 'SRC')).toBe(
            false,
        )
    })

    test('rejects target equal to source / already rekeyed', () => {
        expect(isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), 'L')).toBe(
            false,
        )
        expect(
            isEligibleLedgerRekeyTarget(
                ledger({ address: 'L', rekeyAddress: 'X' }),
                'SRC',
            ),
        ).toBe(false)
    })

    test('accepts a clean hardware target', () => {
        expect(
            isEligibleLedgerRekeyTarget(ledger({ address: 'L' }), 'SRC'),
        ).toBe(true)
    })
})

describe('services/accounts/utils - isEligibleSharedRekeyTarget', () => {
    test('rejects non-multisig targets', () => {
        const all: WalletAccount[] = []
        expect(
            isEligibleSharedRekeyTarget(algo25({ address: 'A' }), 'SRC', all),
        ).toBe(false)
        expect(
            isEligibleSharedRekeyTarget(ledger({ address: 'L' }), 'SRC', all),
        ).toBe(false)
    })

    test('rejects multisig where wallet cannot meet threshold', () => {
        const ms = multisig({
            address: 'M',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        // Only one participant held — threshold is 2 — blocked.
        const all: WalletAccount[] = [algo25({ id: 'p1', address: 'P1' })]
        expect(isEligibleSharedRekeyTarget(ms, 'SRC', all)).toBe(false)
    })

    test('accepts multisig when wallet holds enough participants', () => {
        const ms = multisig({
            address: 'M',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        const all: WalletAccount[] = [
            algo25({ id: 'p1', address: 'P1' }),
            algo25({ id: 'p2', address: 'P2' }),
        ]
        expect(isEligibleSharedRekeyTarget(ms, 'SRC', all)).toBe(true)
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
        expect(isEligibleSharedRekeyTarget(ms, 'SRC', all)).toBe(false)
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

    test('walks multi-hop chain to the terminal auth account', () => {
        // A -> B -> C, terminal is C (no rekeyAddress on C).
        const a = ledger({ address: 'A', rekeyAddress: 'B' })
        const b = ledger({ address: 'B', rekeyAddress: 'C' })
        const c = ledger({ address: 'C' })
        expect(resolveAuthAccount(a, [a, b, c])).toBe(c)
    })

    test('throws RekeyTargetNotFoundError when chain is broken', () => {
        const a = algo25({ address: 'A', rekeyAddress: 'MISSING' })
        expect(() => resolveAuthAccount(a, [a])).toThrow(
            RekeyTargetNotFoundError,
        )
    })

    test('handles a circular rekey gracefully without infinite loop', () => {
        // Pathological: A -> B -> A. Should not hang. Returns whichever
        // node we land on when the cycle is detected (here, B).
        const a = algo25({ address: 'A', rekeyAddress: 'B' })
        const b = algo25({ address: 'B', rekeyAddress: 'A' })
        const result = resolveAuthAccount(a, [a, b])
        expect([a, b]).toContain(result)
    })
})
