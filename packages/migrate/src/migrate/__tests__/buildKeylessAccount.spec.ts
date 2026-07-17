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

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    generateMultisigAddress: vi.fn(
        (version: number, threshold: number, addresses: string[]) =>
            `MSIG:v${version}:t${threshold}:${addresses.join(',')}`,
    ),
    // The accounts barrel installs a network-switch subscription at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
}))

import { AccountTypes } from '@perawallet/wallet-core-accounts'
import { generateMultisigAddress } from '@perawallet/wallet-core-blockchain'
import type { LegacyAccount } from '@perawallet/wallet-extension-platform'
import {
    buildWatchAccount,
    buildLedgerAccount,
    buildMultiSigAccount,
} from '../buildKeylessAccount'

const buildLegacyAccount = (
    overrides: Partial<LegacyAccount> = {},
): LegacyAccount =>
    ({
        address: 'ADDR_LEGACY',
        name: 'Legacy Name',
        type: 'standard',
        preferredOrder: 0,
        isBackedUp: true,
        secretKey: null,
        hdWalletId: null,
        ledger: null,
        joint: null,
        ...overrides,
    }) as LegacyAccount

beforeEach(() => {
    vi.mocked(generateMultisigAddress).mockClear()
})

describe('buildWatchAccount', () => {
    it('builds a watch-type WalletAccount with id, name, and address', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_WATCH',
            name: 'My Watcher',
            type: 'watch',
        })

        const account = buildWatchAccount(legacy)

        expect(account).toEqual({
            id: 'mock-time-uuid',
            name: 'My Watcher',
            type: AccountTypes.watch,
            address: 'ADDR_WATCH',
        })
    })

    it('returns undefined name when legacy name is an empty string', () => {
        const legacy = buildLegacyAccount({ name: '' })

        const account = buildWatchAccount(legacy)

        expect(account.name).toBeUndefined()
    })
})

describe('buildLedgerAccount', () => {
    it('throws when ledger details are missing', () => {
        const legacy = buildLegacyAccount({ type: 'ledger', ledger: null })

        expect(() => buildLedgerAccount(legacy)).toThrow(
            'Ledger account missing ledger details',
        )
    })

    it('maps ledger details into a hardware-type WalletAccount', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_LEDGER',
            name: 'Ledger 1',
            type: 'ledger',
            ledger: {
                bluetoothAddress: 'BT-ADDR',
                bluetoothName: 'Ledger Nano X',
                positionInLedger: 3,
            },
        })

        const account = buildLedgerAccount(legacy)

        expect(account).toEqual({
            id: 'mock-time-uuid',
            name: 'Ledger 1',
            type: AccountTypes.hardware,
            address: 'ADDR_LEDGER',
            hardwareDetails: {
                manufacturer: 'ledger',
                transportType: 'ble',
                deviceId: 'BT-ADDR',
                deviceName: 'Ledger Nano X',
                accountIndex: 3,
            },
        })
    })

    it('defaults deviceName to an empty string when bluetoothName is null', () => {
        const legacy = buildLegacyAccount({
            type: 'ledger',
            ledger: {
                bluetoothAddress: 'BT',
                bluetoothName: null,
                positionInLedger: 0,
            },
        })

        const account = buildLedgerAccount(legacy)

        if (account.type !== AccountTypes.hardware)
            throw new Error('expected hardware account')
        expect(account.hardwareDetails.deviceName).toBe('')
    })

    it('returns undefined name when legacy name is empty', () => {
        const legacy = buildLegacyAccount({
            type: 'ledger',
            name: '',
            ledger: {
                bluetoothAddress: 'BT',
                bluetoothName: 'X',
                positionInLedger: 0,
            },
        })

        const account = buildLedgerAccount(legacy)

        expect(account.name).toBeUndefined()
    })
})

describe('buildMultiSigAccount', () => {
    it('throws when joint details are missing', () => {
        const legacy = buildLegacyAccount({ type: 'joint', joint: null })

        expect(() => buildMultiSigAccount(legacy)).toThrow(
            'Multisig account missing joint details',
        )
    })

    it('throws when participants is empty', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_MSIG',
            type: 'joint',
            joint: { threshold: 2, version: 1, participants: [] },
        })

        expect(() => buildMultiSigAccount(legacy)).toThrow(
            'Multisig account ADDR_MSIG has no participants',
        )
    })

    it('uses the stored threshold when present without deriving', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_MSIG',
            name: 'Joint',
            type: 'joint',
            joint: {
                threshold: 2,
                version: 1,
                participants: ['P1', 'P2', 'P3'],
            },
        })

        const account = buildMultiSigAccount(legacy)

        expect(account).toEqual({
            id: 'mock-time-uuid',
            name: 'Joint',
            type: AccountTypes.multisig,
            address: 'ADDR_MSIG',
            multisigDetails: {
                threshold: 2,
                addresses: ['P1', 'P2', 'P3'],
                version: 1,
            },
        })
        expect(generateMultisigAddress).not.toHaveBeenCalled()
    })

    it('derives the threshold by brute-forcing when not stored', () => {
        const participants = ['P1', 'P2', 'P3']
        const expectedAddress = `MSIG:v1:t2:P1,P2,P3`
        const legacy = buildLegacyAccount({
            address: expectedAddress,
            type: 'joint',
            joint: { threshold: null, version: 1, participants },
        })

        const account = buildMultiSigAccount(legacy)

        if (account.type !== AccountTypes.multisig)
            throw new Error('expected multisig account')
        expect(account.multisigDetails.threshold).toBe(2)
        expect(generateMultisigAddress).toHaveBeenCalledWith(1, 1, participants)
        expect(generateMultisigAddress).toHaveBeenCalledWith(1, 2, participants)
    })

    it('throws when no candidate threshold matches the stored address', () => {
        const legacy = buildLegacyAccount({
            address: 'ADDR_DOES_NOT_MATCH',
            type: 'joint',
            joint: {
                threshold: null,
                version: 1,
                participants: ['P1', 'P2'],
            },
        })

        expect(() => buildMultiSigAccount(legacy)).toThrow(
            /Could not derive multisig threshold for ADDR_DOES_NOT_MATCH/,
        )
    })
})
