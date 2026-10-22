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

import { beforeEach, describe, expect, test } from 'vitest'
import type { HardwareWalletDetails } from '../../models'
import { DuplicateAccountError, InvalidChainAddressError } from '../../errors'
import { buildTestAccount, TEST_CUSTODY } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    ALGORAND_ADDRESS,
    ETHEREUM,
    EVM_KEY_ADDRESS,
    registerChainFamilies,
} from '../../__tests__/chainFamilies'
import { useAccountsStore } from '../store'

const DEVICE: HardwareWalletDetails = {
    ...TEST_CUSTODY.hardware.device,
    accountIndex: 0,
}
const OTHER_ALGORAND_ADDRESS = 'B'.repeat(58)

const ledgerOnAlgorand = (id = 'ledger', accountIndex = 0) =>
    buildTestAccount(
        { ...TEST_CUSTODY.hardware, accountIndex },
        { [ALGORAND]: { address: ALGORAND_ADDRESS } },
        { id, name: 'Ledger 1' },
    )

describe('addHardwareChainAccount', () => {
    const state = () => useAccountsStore.getState()

    beforeEach(() => {
        registerChainFamilies()
        state().resetState()
    })

    test("attaches the chain to the account already at the device's position", () => {
        state().setAccounts([ledgerOnAlgorand()])

        const result = state().addHardwareChainAccount(
            DEVICE,
            ETHEREUM,
            EVM_KEY_ADDRESS.toUpperCase().replace('0X', '0x'),
            'Ledger 2',
        )

        expect(state().accounts).toHaveLength(1)
        expect(result.id).toBe('ledger')
        expect(result.name).toBe('Ledger 1')
        expect(result.chains[ALGORAND]?.address).toBe(ALGORAND_ADDRESS)
        expect(result.chains[ETHEREUM]).toEqual({
            address: EVM_KEY_ADDRESS,
            enabledAt: expect.any(Number),
            enabledBy: 'created',
        })
    })

    test('creates a hardware account on the chain when the device position has none', () => {
        const result = state().addHardwareChainAccount(
            DEVICE,
            ETHEREUM,
            EVM_KEY_ADDRESS,
            'Ledger 1',
        )

        expect(state().accounts).toEqual([result])
        expect(result.name).toBe('Ledger 1')
        expect(result.custody).toEqual({
            kind: 'hardware',
            device: TEST_CUSTODY.hardware.device,
            accountIndex: 0,
        })
        expect(Object.keys(result.chains)).toEqual([ETHEREUM])
    })

    test('keeps another account index of the same device apart', () => {
        state().setAccounts([ledgerOnAlgorand()])

        state().addHardwareChainAccount(
            { ...DEVICE, accountIndex: 1 },
            ETHEREUM,
            EVM_KEY_ADDRESS,
        )

        expect(state().accounts).toHaveLength(2)
        expect(state().accounts[0].chains[ETHEREUM]).toBeUndefined()
    })

    test('returns the holder untouched when it already holds the address there', () => {
        state().setAccounts([ledgerOnAlgorand()])
        const before = state().accounts[0]

        const result = state().addHardwareChainAccount(
            DEVICE,
            ALGORAND,
            ALGORAND_ADDRESS,
        )

        expect(result).toBe(before)
        expect(state().accounts).toEqual([before])
    })

    test("refuses a different address on a chain the device's account already holds", () => {
        state().setAccounts([ledgerOnAlgorand()])

        expect(() =>
            state().addHardwareChainAccount(
                DEVICE,
                ALGORAND,
                OTHER_ALGORAND_ADDRESS,
            ),
        ).toThrow(DuplicateAccountError)
    })

    test('refuses an address another account holds on the chain', () => {
        state().setAccounts([
            buildTestAccount(
                TEST_CUSTODY.watch,
                { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
                { id: 'watch' },
            ),
        ])

        expect(() =>
            state().addHardwareChainAccount(DEVICE, ETHEREUM, EVM_KEY_ADDRESS),
        ).toThrow(DuplicateAccountError)
        expect(state().accounts).toHaveLength(1)
    })

    test("refuses an address that isn't on the chain", () => {
        expect(() =>
            state().addHardwareChainAccount(DEVICE, ETHEREUM, ALGORAND_ADDRESS),
        ).toThrow(InvalidChainAddressError)
        expect(state().accounts).toEqual([])
    })
})

describe('a device position stays one account', () => {
    const state = () => useAccountsStore.getState()

    beforeEach(() => {
        registerChainFamilies()
        state().resetState()
    })

    test("folds an upgraded watch account into the device's account", () => {
        const watch = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
            { id: 'watch' },
        )
        state().setAccounts([ledgerOnAlgorand(), watch])
        state().setSelectedAccountId('watch')

        const upgraded = state().upgradeWatchAccountToHardware(
            'watch',
            DEVICE,
            ETHEREUM,
        )

        expect(upgraded).toBe(true)
        const [only, ...rest] = state().accounts
        expect(rest).toEqual([])
        expect(only.id).toBe('ledger')
        expect(only.custody.kind).toBe('hardware')
        expect(only.chains[ALGORAND]?.address).toBe(ALGORAND_ADDRESS)
        expect(only.chains[ETHEREUM]?.address).toBe(EVM_KEY_ADDRESS)
        expect(state().selectedAccountId).toBe('ledger')
        expect(state().manualAccountOrder).toEqual(['ledger'])
    })

    test("keeps the device account's own entry where both hold the chain", () => {
        const watch = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ALGORAND]: { address: OTHER_ALGORAND_ADDRESS } },
            { id: 'watch' },
        )
        state().setAccounts([ledgerOnAlgorand(), watch])

        state().upgradeWatchAccountToHardware('watch', DEVICE, ALGORAND)

        expect(state().accounts).toHaveLength(1)
        expect(state().accounts[0].chains[ALGORAND]?.address).toBe(
            ALGORAND_ADDRESS,
        )
    })

    test("folds a rebound account into the account already at the device's new id", () => {
        const stale = buildTestAccount(
            {
                ...TEST_CUSTODY.hardware,
                device: { ...TEST_CUSTODY.hardware.device, deviceId: 'old' },
            },
            { [ALGORAND]: { address: ALGORAND_ADDRESS } },
            { id: 'stale' },
        )
        const current = buildTestAccount(
            TEST_CUSTODY.hardware,
            { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
            { id: 'current' },
        )
        state().setAccounts([stale, current])

        const updated = state().updateHardwareDetails('stale', DEVICE, ALGORAND)

        expect(updated).toBe(true)
        expect(state().accounts).toHaveLength(1)
        expect(state().accounts[0].id).toBe('current')
        expect(state().accounts[0].chains[ALGORAND]?.address).toBe(
            ALGORAND_ADDRESS,
        )
        expect(state().accounts[0].chains[ETHEREUM]?.address).toBe(
            EVM_KEY_ADDRESS,
        )
    })

    test('refuses to bind on a chain the account holds no entry on', () => {
        const watch = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
            { id: 'watch' },
        )
        state().setAccounts([watch])

        expect(
            state().upgradeWatchAccountToHardware('watch', DEVICE, ALGORAND),
        ).toBe(false)
        expect(state().accounts).toEqual([watch])
    })
})
