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

import { beforeEach, describe, test, expect } from 'vitest'
import {
    accountType,
    canSignArbitraryData,
    canSignArc60,
    canSignProgram,
    canSignViaParticipants,
    findAccountByKey,
    getAccountDisplayName,
    hasSigningKeys,
    isAlgo25Account,
    isQuantumAccount,
    isHardwareWalletAccount,
    isHDWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isWatchAccount,
    matchesAccountKey,
    resolveImportAccountType,
} from '../utils'
import { withCustody } from '../credentials'
import {
    AccountTypes,
    DerivationTypes,
    type AccountType,
    type WalletAccount,
} from '../models'
import { MNEMONIC_WORD_COUNT } from '../constants'
import { buildTestAccount } from './accountFactory'
import {
    FAKE_CHAIN_ID,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

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

    const guards: Record<AccountType, (account: WalletAccount) => boolean> = {
        algo25: isAlgo25Account,
        quantum: isQuantumAccount,
        hdWallet: isHDWalletAccount,
        hardware: isHardwareWalletAccount,
        multisig: isMultisigAccount,
        watch: isWatchAccount,
    }

    test.each(Object.values(AccountTypes))(
        'the %s guard follows provenance over a contradicting stored type',
        type => {
            const storedType =
                type === AccountTypes.watch
                    ? AccountTypes.algo25
                    : AccountTypes.watch
            const account = {
                ...buildTestAccount(type),
                type: storedType,
            } as WalletAccount

            expect(guards[type](account)).toBe(true)
            expect(guards[storedType](account)).toBe(false)
        },
    )

    test('hasSigningKeys checks keyPairId', () => {
        expect(hasSigningKeys(baseAccount)).toBe(true)
        expect(
            hasSigningKeys({
                ...baseAccount,
                keyPairId: undefined,
            } as any),
        ).toBe(false)
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
        expect(canSignArc60(localKey)).toBe(true)
        expect(canSignArc60(hardware)).toBe(true)
        expect(canSignArc60(watch)).toBe(false)
        expect(canSignArc60(multisig)).toBe(false)
    })

    // An ARC-60 signature verifies against `signer`'s own public key, so the
    // rekey hop is never consulted: a keyless rekeyed signer is refused no
    // matter what its auth account could do, and a rekeyed signer that still
    // holds its key signs with that key.
    describe('canSignArc60 - rekeyed signers', () => {
        test('rejects a keyless rekeyed account even when its auth account could sign', () => {
            const rekeyedToLocalKey = {
                ...watch,
                rekeyAddress: localKey.address,
            } as any
            const rekeyedToHardware = {
                ...watch,
                rekeyAddress: hardware.address,
            } as any
            expect(canSignArc60(rekeyedToLocalKey)).toBe(false)
            expect(canSignArc60(rekeyedToHardware)).toBe(false)
        })

        test('accepts a rekeyed account that still holds its own key', () => {
            const rekeyed = { ...localKey, rekeyAddress: watch.address } as any
            expect(canSignArc60(rekeyed)).toBe(true)
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
        expect(canSignArc60(quantum())).toBe(true)
    })

    test('quantum keys are not valid multisig participants (Ed25519-only protocol)', () => {
        expect(canSignViaParticipants(['F'], [quantum({ address: 'F' })])).toBe(
            false,
        )
    })
})

describe('services/accounts/utils - authority wrappers', () => {
    const account = {
        ...algo25({ address: 'A' }),
    } as WalletAccount

    beforeEach(() => {
        registerFakeAccountsChain({
            authority: {
                isDelegated: vi.fn(() => true),
                accountsDelegatedTo: vi.fn(() => []),
                isEligibleTarget: vi.fn(() => false),
                canSignProgram: vi.fn(() => true),
            },
        })
    })

    test("isRekeyedAccount and canSignProgram defer to the chain's authority", () => {
        const { authority } = fakeAccountsChain().adapter

        expect(isRekeyedAccount(account, FAKE_CHAIN_ID)).toBe(true)
        expect(canSignProgram(account, FAKE_CHAIN_ID)).toBe(true)
        expect(authority?.isDelegated).toHaveBeenCalledWith(account)
        expect(authority?.canSignProgram).toHaveBeenCalledWith(account)
    })

    test('fail closed on a chain without an authority', () => {
        registerFakeAccountsChain({ authority: undefined })

        expect(isRekeyedAccount(account, FAKE_CHAIN_ID)).toBe(false)
        expect(canSignProgram(account, FAKE_CHAIN_ID)).toBe(false)
    })

    test('isRekeyedAccount is false for a missing account', () => {
        expect(isRekeyedAccount(null, FAKE_CHAIN_ID)).toBe(false)
    })
})

describe('services/accounts/utils - accountType', () => {
    const allTypes = Object.values(AccountTypes)

    const ledger = (transportType: 'ble' | 'usb') =>
        ({
            id: `h-${transportType}`,
            address: `LEDGER-${transportType}-ADDR`,
            type: AccountTypes.hardware,
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: `${transportType}-1`,
                deviceName: 'Nano X',
                accountIndex: 2,
                transportType,
            },
        }) as const satisfies WalletAccount

    // Keyed by type so a new AccountTypes member without a fixture fails typecheck.
    const legacyFixtures: Record<AccountType, WalletAccount[]> = {
        algo25: [
            {
                id: 'a',
                address: 'ALGO25-ADDR',
                type: AccountTypes.algo25,
                keyPairId: 'seed-ed25519',
            },
        ],
        quantum: [
            {
                id: 'q',
                address: 'QUANTUM-ADDR',
                type: AccountTypes.quantum,
                keyPairId: 'seed-quantum',
            },
        ],
        hdWallet: Object.values(DerivationTypes).map(derivationType => ({
            id: `hd-${derivationType}`,
            address: `HD-${derivationType}-ADDR`,
            type: AccountTypes.hdWallet,
            keyPairId: `seed-dt${derivationType}`,
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 3,
                derivationType,
            },
        })),
        hardware: [ledger('ble'), ledger('usb')],
        multisig: [
            {
                id: 'm',
                address: 'MSIG-ADDR',
                type: AccountTypes.multisig,
                multisigDetails: {
                    threshold: 2,
                    addresses: ['P1', 'P2', 'P3'],
                    version: 1,
                },
            },
        ],
        watch: [{ id: 'w', address: 'WATCH-ADDR', type: AccountTypes.watch }],
    }

    const backfilledCases = Object.values(legacyFixtures)
        .flat()
        .map(account => [account.id, account] as const)

    const rekeyed = (account: WalletAccount): WalletAccount => ({
        ...account,
        rekeyAddress: 'AUTH-ADDR',
        rekeyAddressByNetwork: { mainnet: 'AUTH-ADDR', testnet: 'OTHER-AUTH' },
    })

    test.each(backfilledCases)(
        'a backfilled %s account derives its stored type',
        (_, legacy) => {
            const backfilled = withCustody(legacy)

            expect(backfilled.provenance).toBeDefined()
            expect(accountType(backfilled)).toBe(legacy.type)
        },
    )

    test.each(allTypes)('a built %s account derives its stored type', type => {
        const account = buildTestAccount(type)

        expect(accountType(account)).toBe(type)
        expect(accountType(account)).toBe(account.type)
    })

    test.each(allTypes)('a rekeyed %s account keeps its own type', type => {
        const account = rekeyed(buildTestAccount(type))

        expect(accountType(account)).toBe(type)
    })

    test('provenance decides when it disagrees with the stored type', () => {
        const account = {
            ...buildTestAccount(AccountTypes.watch),
            type: AccountTypes.algo25,
        } as WalletAccount

        expect(accountType(account)).toBe(AccountTypes.watch)
    })

    test('a record the backfill skips falls back to its stored type', () => {
        const malformed = withCustody({
            id: 'm',
            address: 'MSIG-ADDR',
            type: AccountTypes.multisig,
        } as WalletAccount)

        expect(malformed.provenance).toBeUndefined()
        expect(accountType(malformed)).toBe(AccountTypes.multisig)
    })
})
