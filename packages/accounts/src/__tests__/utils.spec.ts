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
import { beforeEach, describe, test, expect, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    canSignArbitraryData,
    canSignDirectly,
    canSignProgram,
    findAccountByAddressOn,
    getAccountDisplayName,
    hasSigningKeys,
    isHardwareWalletAccount,
    isLedgerAccount,
    isMultisigAccount,
    isRekeyedAccount,
    isSameAddress,
    isWatchAccount,
} from '../utils'
import type { WalletAccount } from '../models'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
    type TestCustody,
} from './accountFactory'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

const OTHER_CHAIN_ID = 'ethereum' as ChainId
const LONG_ADDRESS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const named = (address: string, name?: string): WalletAccount =>
    testAccount('hd', address, name === undefined ? {} : { name })

describe('services/accounts/utils - getAccountDisplayName', () => {
    test('returns the account name when present', () => {
        expect(
            getAccountDisplayName(named(LONG_ADDRESS, 'Named'), FAKE_CHAIN_ID),
        ).toBe('Named')
    })

    test("truncates the address through the chain's codec when unnamed", () => {
        expect(getAccountDisplayName(named(LONG_ADDRESS), FAKE_CHAIN_ID)).toBe(
            fakeAccountsChain().codec.truncate(LONG_ADDRESS),
        )
        expect(getAccountDisplayName(named(LONG_ADDRESS), FAKE_CHAIN_ID)).toBe(
            'ABC~XYZ',
        )
    })

    test('returns the address unchanged when the codec keeps it whole', () => {
        expect(getAccountDisplayName(named('SHORT'), FAKE_CHAIN_ID)).toBe(
            'SHORT',
        )
    })

    test('returns the full address on a chain without a registered codec', () => {
        const account = buildTestAccount(TEST_CUSTODY.watch, {
            [OTHER_CHAIN_ID]: { address: LONG_ADDRESS },
        })

        expect(getAccountDisplayName(account, OTHER_CHAIN_ID)).toBe(
            LONG_ADDRESS,
        )
    })

    test('reads the address on the chain asked for, not another', () => {
        const account = buildTestAccount(TEST_CUSTODY.watch, {
            [FAKE_CHAIN_ID]: { address: LONG_ADDRESS },
        })

        expect(getAccountDisplayName(account, OTHER_CHAIN_ID)).toBe(
            'No Address Found',
        )
        expect(
            getAccountDisplayName({ ...account, name: 'Kept' }, OTHER_CHAIN_ID),
        ).toBe('Kept')
    })

    test('returns "No Address Found" when the address is empty', () => {
        expect(getAccountDisplayName(named(''), FAKE_CHAIN_ID)).toBe(
            'No Address Found',
        )
    })

    test.each([
        ['the full address', LONG_ADDRESS],
        ['a 5+5 truncation', 'ABCDE...VWXYZ'],
        ['a legacy 6+6 truncation', 'ABCDEF...UVWXYZ'],
        ['a unicode-ellipsis truncation', 'ABCDEF…UVWXYZ'],
    ])('treats a name that is %s as no name', (_, name) => {
        expect(
            getAccountDisplayName(named(LONG_ADDRESS, name), FAKE_CHAIN_ID),
        ).toBe('ABC~XYZ')
    })

    test('keeps a custom name that only looks like a truncation', () => {
        expect(
            getAccountDisplayName(
                named(LONG_ADDRESS, 'ABCDEF...WRONG'),
                FAKE_CHAIN_ID,
            ),
        ).toBe('ABCDEF...WRONG')
    })

    test('returns "No Account" when the account is null', () => {
        expect(getAccountDisplayName(null, FAKE_CHAIN_ID)).toBe('No Account')
    })
})

describe('services/accounts/utils - custody guards', () => {
    const guards: Record<
        'hardware' | 'multisig' | 'watch',
        (account: WalletAccount) => boolean
    > = {
        hardware: isHardwareWalletAccount,
        multisig: isMultisigAccount,
        watch: isWatchAccount,
    }

    test.each(Object.keys(TEST_CUSTODY) as TestCustody[])(
        'each guard matches a %s account only when it is of its custody',
        custody => {
            const account = testAccount(custody)

            for (const [kind, guard] of Object.entries(guards)) {
                expect(guard(account)).toBe(account.custody.kind === kind)
            }
        },
    )

    test('isLedgerAccount reads the paired device manufacturer', () => {
        const hardware = testAccount('hardware')
        const other = buildTestAccount(
            {
                ...TEST_CUSTODY.hardware,
                device: {
                    ...TEST_CUSTODY.hardware.device,
                    manufacturer: 'other' as 'ledger',
                },
            },
            { [FAKE_CHAIN_ID]: { address: 'OTHER' } },
        )

        expect(isLedgerAccount(hardware)).toBe(true)
        expect(isLedgerAccount(other)).toBe(false)
        expect(isLedgerAccount(testAccount('local'))).toBe(false)
    })
})

describe('services/accounts/utils - signing capability', () => {
    test.each([
        ['local', true, true, true],
        ['hd', true, true, true],
        ['hardware', false, true, false],
        ['multisig', false, false, false],
        ['watch', false, false, false],
    ] as const)(
        'a %s account: keys %s, direct signing %s, arbitrary data %s',
        (custody, keys, direct, arbitrary) => {
            const account = testAccount(custody)

            expect(hasSigningKeys(account)).toBe(keys)
            expect(canSignDirectly(account)).toBe(direct)
            expect(canSignArbitraryData(account)).toBe(arbitrary)
        },
    )

    test('a key on any chain counts as a signing key', () => {
        const account = buildTestAccount(TEST_CUSTODY.local, {
            [OTHER_CHAIN_ID]: { address: '0xA', keyPairId: 'evm-key' },
            [FAKE_CHAIN_ID]: { address: 'A' },
        })

        expect(hasSigningKeys(account)).toBe(true)
    })

    test('a rekeyed watch account still cannot sign arbitrary data', () => {
        const account = testAccount('watch', 'W', {
            rekeyAddress: 'LOCAL-ADDR',
        })

        expect(canSignArbitraryData(account)).toBe(false)
    })
})

describe('services/accounts/utils - authority wrappers', () => {
    const account = testAccount('local', 'A')

    beforeEach(() => {
        useNetworkStore.getState().setNetwork('mainnet')
        registerFakeAccountsChain({
            authority: {
                targetKinds: ['fake-target-local'],
                isDelegated: vi.fn(() => true),
                accountsDelegatedTo: vi.fn(() => []),
                isEligibleTarget: vi.fn(() => false),
                canSignProgram: vi.fn(() => true),
                isAuthorityDowngrade: vi.fn(() => false),
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

describe('services/accounts/utils - address lookups', () => {
    const onFake = testAccount('watch', 'SHARED')
    const onOther = buildTestAccount(TEST_CUSTODY.watch, {
        [OTHER_CHAIN_ID]: { address: 'SHARED' },
    })

    test('finds the account holding the address on that chain only', () => {
        const accounts = [onOther, onFake]

        expect(findAccountByAddressOn(accounts, FAKE_CHAIN_ID, 'SHARED')).toBe(
            onFake,
        )
        expect(findAccountByAddressOn(accounts, OTHER_CHAIN_ID, 'SHARED')).toBe(
            onOther,
        )
        expect(
            findAccountByAddressOn(accounts, FAKE_CHAIN_ID, 'MISSING'),
        ).toBeUndefined()
    })

    test("compares through the chain's codec", () => {
        fakeAccountsChain().codec.areEqual = (a, b) =>
            a.toLowerCase() === b.toLowerCase()

        expect(isSameAddress(FAKE_CHAIN_ID, 'abc', 'ABC')).toBe(true)
        expect(findAccountByAddressOn([onFake], FAKE_CHAIN_ID, 'shared')).toBe(
            onFake,
        )
    })

    test('falls back to string equality on a chain without a codec', () => {
        expect(isSameAddress(OTHER_CHAIN_ID, 'abc', 'abc')).toBe(true)
        expect(isSameAddress(OTHER_CHAIN_ID, 'abc', 'ABC')).toBe(false)
    })
})
