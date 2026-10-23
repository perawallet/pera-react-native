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

    test('keeps a USB import apart: its id names a model, not a device', () => {
        state().setAccounts([
            buildTestAccount(
                {
                    ...TEST_CUSTODY.hardware,
                    device: {
                        ...TEST_CUSTODY.hardware.device,
                        transportType: 'usb',
                    },
                },
                { [ALGORAND]: { address: ALGORAND_ADDRESS } },
                { id: 'usb-ledger' },
            ),
        ])

        const result = state().addHardwareChainAccount(
            { ...DEVICE, transportType: 'usb' },
            ETHEREUM,
            EVM_KEY_ADDRESS,
        )

        expect(state().accounts).toHaveLength(2)
        expect(result.id).not.toBe('usb-ledger')
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

    test('creates an account for another seed at a position the wallet holds', () => {
        state().setAccounts([ledgerOnAlgorand()])

        const result = state().addHardwareChainAccount(
            DEVICE,
            ALGORAND,
            OTHER_ALGORAND_ADDRESS,
            'Ledger 2',
        )

        expect(state().accounts).toHaveLength(2)
        expect(result.id).not.toBe('ledger')
        expect(result.chains[ALGORAND]?.address).toBe(OTHER_ALGORAND_ADDRESS)
    })

    test("attaches to the position's account that agrees with the address, not another seed's", () => {
        const otherSeed = buildTestAccount(
            TEST_CUSTODY.hardware,
            { [ALGORAND]: { address: OTHER_ALGORAND_ADDRESS } },
            { id: 'other-seed' },
        )
        state().setAccounts([otherSeed, ledgerOnAlgorand()])

        const result = state().addHardwareChainAccount(
            DEVICE,
            ALGORAND,
            ALGORAND_ADDRESS,
        )

        expect(result.id).toBe('ledger')
        expect(state().accounts).toHaveLength(2)
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

    test("upgrades in place when the position's account holds another address on the chain", () => {
        const watch = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ALGORAND]: { address: OTHER_ALGORAND_ADDRESS } },
            { id: 'watch' },
        )
        state().setAccounts([ledgerOnAlgorand(), watch])

        expect(
            state().upgradeWatchAccountToHardware('watch', DEVICE, ALGORAND),
        ).toBe(true)

        const [ledger, upgraded] = state().accounts
        expect(ledger.chains[ALGORAND]?.address).toBe(ALGORAND_ADDRESS)
        expect(upgraded.id).toBe('watch')
        expect(upgraded.custody.kind).toBe('hardware')
        expect(upgraded.chains[ALGORAND]?.address).toBe(OTHER_ALGORAND_ADDRESS)
    })

    test("rebinds in place, losing nothing, when the new position's account holds another address", () => {
        const stale = buildTestAccount(
            {
                ...TEST_CUSTODY.hardware,
                device: { ...TEST_CUSTODY.hardware.device, deviceId: 'old' },
            },
            { [ALGORAND]: { address: ALGORAND_ADDRESS } },
            { id: 'stale', name: 'Mine' },
        )
        const otherSeed = buildTestAccount(
            TEST_CUSTODY.hardware,
            { [ALGORAND]: { address: OTHER_ALGORAND_ADDRESS } },
            { id: 'other-seed' },
        )
        state().setAccounts([stale, otherSeed])

        state().updateHardwareDetails('stale', DEVICE, ALGORAND)

        const rebound = state().accounts.find(a => a.id === 'stale')
        expect(state().accounts).toHaveLength(2)
        expect(rebound?.name).toBe('Mine')
        expect(rebound?.custody).toMatchObject({
            device: { deviceId: TEST_CUSTODY.hardware.device.deviceId },
        })
        expect(rebound?.chains[ALGORAND]?.address).toBe(ALGORAND_ADDRESS)
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

    test('upgrades in place at a USB position instead of joining its account', () => {
        const usbDevice = {
            ...TEST_CUSTODY.hardware.device,
            transportType: 'usb' as const,
        }
        const usbLedger = buildTestAccount(
            { ...TEST_CUSTODY.hardware, device: usbDevice },
            { [ALGORAND]: { address: ALGORAND_ADDRESS } },
            { id: 'usb-ledger' },
        )
        const watch = buildTestAccount(
            TEST_CUSTODY.watch,
            { [ETHEREUM]: { address: EVM_KEY_ADDRESS } },
            { id: 'watch' },
        )
        state().setAccounts([usbLedger, watch])

        state().upgradeWatchAccountToHardware(
            'watch',
            { ...usbDevice, accountIndex: 0 },
            ETHEREUM,
        )

        expect(state().accounts).toHaveLength(2)
        expect(state().accounts[1]).toMatchObject({
            id: 'watch',
            custody: { kind: 'hardware' },
        })
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
