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
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
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
import {
    AccountTypes,
    DerivationTypes,
    type AccountType,
    type WalletAccount,
} from '../models'
import { useAccountChainStateStore } from '../store'
import { MNEMONIC_WORD_COUNT } from '../constants'
import { buildTestAccount } from './accountFactory'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
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
        custody: { kind: 'local', seed: 'algo25' },
        keyPairId: 'kp',
    } as WalletAccount
    const watch = { address: 'P2', custody: { kind: 'watch' } } as WalletAccount
    const hardware = {
        address: 'P3',
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
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'Named',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('Named')
    })

    test('returns "No Address Found" when address is missing or empty', () => {
        const acc = {
            id: '2',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: '',
            canSign: false,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('No Address Found')
    })

    test('returns address unchanged when length <= 11', () => {
        const acc1 = {
            id: '3',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'SHORT',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc1)).toEqual('SHORT')

        const acc2 = {
            id: '4',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'ABCDEFGHIJK',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc2)).toEqual('ABCDEFGHIJK')
    })

    test('truncates long addresses to 5 prefix and suffix characters', () => {
        const acc1 = {
            id: '5',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'ABCDEFGHIJKL',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc1)).toEqual('ABCDE...HIJKL')

        const acc2 = {
            id: '6',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc2)).toEqual('ABCDE...VWXYZ')
    })

    test('falls back to the truncated address when the name is the full address', () => {
        const acc = {
            id: '7',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDE...VWXYZ')
    })

    test('falls back to the truncated address when the name is the truncated address', () => {
        const acc = {
            id: '8',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
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
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDEF...UVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDE...VWXYZ')
    })

    test('falls back to the truncated address when the name truncates the address with a unicode ellipsis', () => {
        const acc = {
            id: '10',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'ABCDEF…UVWXYZ',
            canSign: true,
        } as any
        expect(getAccountDisplayName(acc)).toEqual('ABCDE...VWXYZ')
    })

    test('keeps a custom name that only looks like a truncation but does not match the address', () => {
        const acc = {
            id: '11',
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            },
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
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        address: 'ADDR1',
        keyPairId: 'pk1',
    } as any

    test('isHDWalletAccount returns true if type is hdWallet', () => {
        expect(isHDWalletAccount(baseAccount)).toBe(true)
        expect(
            isHDWalletAccount({
                ...baseAccount,
                custody: { kind: 'local', seed: 'algo25' },
            } as any),
        ).toBe(false)
    })

    test('isLedgerAccount returns true if type is hardware and manufacturer is ledger', () => {
        expect(isLedgerAccount(baseAccount)).toBe(false)
        expect(
            isLedgerAccount({
                ...baseAccount,
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
                custody: {
                    kind: 'hardware',
                    device: {
                        manufacturer: 'other' as any,
                        deviceId: 'device-1',
                        deviceName: 'Nano X',
                        transportType: 'ble',
                    },
                    accountIndex: 0,
                },
                hardwareDetails: { manufacturer: 'other' as any },
            } as any),
        ).toBe(false)
    })

    test('isAlgo25Account returns true if type is algo25', () => {
        expect(isAlgo25Account(baseAccount)).toBe(false)
        expect(
            isAlgo25Account({
                ...baseAccount,
                custody: { kind: 'local', seed: 'algo25' },
            } as any),
        ).toBe(true)
        expect(
            isAlgo25Account({
                ...baseAccount,
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            } as any),
        ).toBe(false)
        expect(
            isAlgo25Account({
                ...baseAccount,
                custody: { kind: 'watch' },
            } as any),
        ).toBe(false)
    })

    test('isWatchAccount returns true if type is watch', () => {
        expect(isWatchAccount(baseAccount)).toBe(false)
        expect(
            isWatchAccount({
                ...baseAccount,
                custody: { kind: 'watch' },
            } as any),
        ).toBe(true)
    })

    test('isMultisigAccount returns true if type is multisig', () => {
        expect(isMultisigAccount(baseAccount)).toBe(false)
        expect(
            isMultisigAccount({
                ...baseAccount,
                custody: { kind: 'multisig' },
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
        'the %s guard matches only an account of its own kind',
        type => {
            const account = buildTestAccount(type)

            for (const [kind, guard] of Object.entries(guards)) {
                expect(guard(account)).toBe(kind === type)
            }
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
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 0, keyIndex: 0 },
        },
        address: 'HD',
        keyPairId: 'pk1',
    } as any
    const hardware = {
        custody: {
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'dev',
                deviceName: 'Ledger Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        },
        address: 'HW',
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'dev',
            deviceName: 'Ledger Nano X',
            accountIndex: 0,
            transportType: 'ble',
        },
    } as any
    const watch = { custody: { kind: 'watch' }, address: 'WATCH' } as any
    const multisig = {
        custody: { kind: 'multisig' },
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
        beforeEach(() => {
            registerFakeAccountsChain()
            useAccountChainStateStore.getState().resetState()
        })

        test('rejects a keyless rekeyed account even when its auth account could sign', () => {
            seedAuthority(watch.address, localKey.address)
            expect(canSignArc60(watch)).toBe(false)

            seedAuthority(watch.address, hardware.address)
            expect(canSignArc60(watch)).toBe(false)
        })

        test('accepts a rekeyed account that still holds its own key', () => {
            seedAuthority(localKey.address, watch.address)
            expect(canSignArc60(localKey)).toBe(true)
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
        custody: { kind: 'local', seed: 'algo25' },
        keyPairId: 'kp',
        ...overrides,
    }) as WalletAccount

const hd = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
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
    }) as WalletAccount

const ledger = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
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
    }) as WalletAccount

const watch = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'w',
        address: overrides.address ?? 'W',
        custody: { kind: 'watch' },
        ...overrides,
    }) as WalletAccount

const multisig = (overrides: Partial<WalletAccount> = {}): WalletAccount =>
    ({
        id: overrides.id ?? 'm',
        address: overrides.address ?? 'M',
        custody: { kind: 'multisig' },
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
        custody: { kind: 'local', seed: 'quantum' },
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
        useNetworkStore.getState().setNetwork('mainnet')
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
        expect(authority?.isDelegated).toHaveBeenCalledWith(
            account,
            MAINNET_SCOPE,
        )
        expect(authority?.canSignProgram).toHaveBeenCalledWith(
            account,
            MAINNET_SCOPE,
        )
    })

    test('ask the chain on the selected network', () => {
        const { authority } = fakeAccountsChain().adapter
        useNetworkStore.getState().setNetwork('testnet')

        isRekeyedAccount(account, FAKE_CHAIN_ID)
        canSignProgram(account, FAKE_CHAIN_ID)

        expect(authority?.isDelegated).toHaveBeenCalledWith(
            account,
            TESTNET_SCOPE,
        )
        expect(authority?.canSignProgram).toHaveBeenCalledWith(
            account,
            TESTNET_SCOPE,
        )
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
            custody: {
                kind: 'hardware',
                device: {
                    manufacturer: 'ledger',
                    deviceId: `${transportType}-1`,
                    deviceName: 'Nano X',
                    transportType: transportType,
                },
                accountIndex: 2,
            },
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
                custody: { kind: 'local', seed: 'algo25' },
                keyPairId: 'seed-ed25519',
            },
        ],
        quantum: [
            {
                id: 'q',
                address: 'QUANTUM-ADDR',
                custody: { kind: 'local', seed: 'quantum' },
                keyPairId: 'seed-quantum',
            },
        ],
        hdWallet: Object.values(DerivationTypes).map(derivationType => ({
            id: `hd-${derivationType}`,
            address: `HD-${derivationType}-ADDR`,
            custody: {
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 3 },
            },
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
                custody: { kind: 'multisig' },
                multisigDetails: {
                    threshold: 2,
                    addresses: ['P1', 'P2', 'P3'],
                    version: 1,
                },
            },
        ],
        watch: [{ id: 'w', address: 'WATCH-ADDR', custody: { kind: 'watch' } }],
    }

    const fixtureCases = Object.entries(legacyFixtures).flatMap(
        ([kind, accounts]) =>
            accounts.map(account => [account.id, account, kind] as const),
    )

    test.each(fixtureCases)(
        'the %s fixture reads as its kind',
        (_, account, kind) => {
            expect(accountType(account)).toBe(kind)
        },
    )

    test.each(allTypes)('a built %s account reads as its kind', type => {
        const account = buildTestAccount(type)

        expect(accountType(account)).toBe(type)
        expect(account).not.toHaveProperty('type')
    })

    test.each(allTypes)('a rekeyed %s account keeps its own type', type => {
        registerFakeAccountsChain()
        const account = buildTestAccount(type)
        seedAuthority(account.address, 'AUTH-ADDR')

        expect(accountType(account)).toBe(type)
    })
})
